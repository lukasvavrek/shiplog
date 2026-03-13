import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, changelogs } from "@/db/schema";
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

  const existing = await getChangelogForUser(session.user.id, id, changelogId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const updates: Partial<typeof existing> = {};
  if (typeof body.title === "string") updates.title = body.title;
  if (typeof body.content === "string") updates.content = body.content;
  if (typeof body.published === "boolean") {
    updates.published = body.published;
    if (body.published && !existing.publishedAt) {
      updates.publishedAt = new Date();
    }
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
