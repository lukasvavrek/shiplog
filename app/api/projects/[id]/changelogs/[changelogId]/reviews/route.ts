import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, changelogs, teamMembers, changelogReviews, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

// GET: list reviews for a changelog (project owner or reviewer)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; changelogId: string }> }
) {
  const { id, changelogId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Must be project owner or an accepted team member
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = project.userId === session.user.id;
  if (!isOwner) {
    const membership = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.projectId, id),
        eq(teamMembers.userId, session.user.id)
      ),
    });
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const reviews = await db.query.changelogReviews.findMany({
    where: eq(changelogReviews.changelogId, changelogId),
    with: { reviewer: { columns: { id: true, name: true, email: true, image: true } } },
    orderBy: (r, { desc }) => [desc(r.createdAt)],
  });

  return NextResponse.json(reviews);
}

// POST: submit a review (approve or request changes)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; changelogId: string }> }
) {
  const { id, changelogId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Must be an accepted team member (not the owner — owners can't review their own changelogs)
  const membership = await db.query.teamMembers.findFirst({
    where: and(
      eq(teamMembers.projectId, id),
      eq(teamMembers.userId, session.user.id)
    ),
  });
  if (!membership || !membership.inviteAcceptedAt) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const changelog = await db.query.changelogs.findFirst({
    where: and(eq(changelogs.id, changelogId), eq(changelogs.projectId, id)),
  });
  if (!changelog) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (changelog.reviewStatus !== "in_review") {
    return NextResponse.json({ error: "Changelog is not in review" }, { status: 400 });
  }

  const body = await req.json();
  const status = body.status === "approved" ? "approved" : "changes_requested";
  const comment = typeof body.comment === "string" ? body.comment.trim() : null;

  // Upsert: one review per reviewer per changelog
  const existing = await db.query.changelogReviews.findFirst({
    where: and(
      eq(changelogReviews.changelogId, changelogId),
      eq(changelogReviews.reviewerId, session.user.id)
    ),
  });

  let review;
  if (existing) {
    [review] = await db
      .update(changelogReviews)
      .set({ status, comment, updatedAt: new Date() })
      .where(eq(changelogReviews.id, existing.id))
      .returning();
  } else {
    [review] = await db
      .insert(changelogReviews)
      .values({
        id: nanoid(),
        changelogId,
        reviewerId: session.user.id,
        status,
        comment,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
  }

  // If approved, advance changelog to 'approved'
  if (status === "approved") {
    await db
      .update(changelogs)
      .set({ reviewStatus: "approved", updatedAt: new Date() })
      .where(eq(changelogs.id, changelogId));
  } else if (status === "changes_requested") {
    // Send back to draft
    await db
      .update(changelogs)
      .set({ reviewStatus: "draft", updatedAt: new Date() })
      .where(eq(changelogs.id, changelogId));
  }

  return NextResponse.json(review, { status: 201 });
}
