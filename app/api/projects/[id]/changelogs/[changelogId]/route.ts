import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, changelogs, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

async function getChangelogForUser(
  userId: string,
  projectId: string,
  changelogId: string
) {
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
  if (!project) return null;

  return db.query.changelogs.findFirst({
    where: and(
      eq(changelogs.id, changelogId),
      eq(changelogs.projectId, projectId)
    ),
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; changelogId: string }> }
) {
  const { id, changelogId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [existing, user] = await Promise.all([
    getChangelogForUser(session.user.id, id, changelogId),
    db.query.users.findFirst({ where: eq(users.id, session.user.id) }),
  ]);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isTeamPlan = user?.plan === "team";
  const body = await req.json();
  const updates: Partial<typeof existing> = {};

  if (typeof body.title === "string") updates.title = body.title;
  if (typeof body.content === "string") updates.content = body.content;

  // Handle review status transition: request review (draft → in_review)
  if (body.requestReview === true && isTeamPlan) {
    if (existing.reviewStatus !== "draft") {
      return NextResponse.json(
        { error: "Changelog must be in draft to request review" },
        { status: 400 }
      );
    }
    updates.reviewStatus = "in_review";
  }

  // Handle publishing
  if (typeof body.published === "boolean" && body.published) {
    // Team plan: require approval before publishing
    if (isTeamPlan && existing.reviewStatus !== "approved") {
      return NextResponse.json(
        { error: "Changelog must be approved before publishing on Team plan" },
        { status: 400 }
      );
    }
    updates.published = true;
    updates.reviewStatus = "published";
    if (!existing.publishedAt) {
      updates.publishedAt = new Date();
    }
  } else if (typeof body.published === "boolean" && !body.published) {
    updates.published = false;
  }

  const [updated] = await db
    .update(changelogs)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(changelogs.id, changelogId))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; changelogId: string }> }
) {
  const { id, changelogId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await getChangelogForUser(session.user.id, id, changelogId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.delete(changelogs).where(eq(changelogs.id, changelogId));
  return NextResponse.json({ ok: true });
}
