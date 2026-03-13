import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, teamMembers, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify ownership + Team plan
  const [project, user] = await Promise.all([
    db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.userId, session.user.id)),
    }),
    db.query.users.findFirst({ where: eq(users.id, session.user.id) }),
  ]);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user?.plan !== "team") return NextResponse.json({ error: "Team plan required" }, { status: 403 });

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.id, memberId), eq(teamMembers.projectId, id)),
  });
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  await db.delete(teamMembers).where(eq(teamMembers.id, memberId));
  return NextResponse.json({ ok: true });
}
