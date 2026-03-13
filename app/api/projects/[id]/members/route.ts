import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, teamMembers, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

// Helper: verify the session user owns this project and is on the Team plan
async function getProjectForTeamOwner(userId: string, projectId: string) {
  const [project, user] = await Promise.all([
    db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
    }),
    db.query.users.findFirst({ where: eq(users.id, userId) }),
  ]);
  if (!project) return { error: "Project not found", status: 404 };
  if (user?.plan !== "team") return { error: "Team plan required", status: 403 };
  return { project };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getProjectForTeamOwner(session.user.id, id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const members = await db.query.teamMembers.findMany({
    where: eq(teamMembers.projectId, id),
    with: { user: { columns: { id: true, name: true, email: true, image: true } } },
    orderBy: (m, { asc }) => [asc(m.createdAt)],
  });

  return NextResponse.json(members);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getProjectForTeamOwner(session.user.id, id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const body = await req.json();
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  // Prevent duplicate invites
  const existing = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.projectId, id), eq(teamMembers.email, email)),
  });
  if (existing) {
    return NextResponse.json({ error: "Already invited" }, { status: 409 });
  }

  // If the invitee already has an account, link it
  const invitee = await db.query.users.findFirst({ where: eq(users.email, email) });

  const inviteToken = nanoid(32);
  const [member] = await db
    .insert(teamMembers)
    .values({
      id: nanoid(),
      projectId: id,
      userId: invitee?.id ?? null,
      email,
      role: "reviewer",
      inviteToken,
      inviteAcceptedAt: invitee ? new Date() : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  // Return the invite link for the owner to share
  const inviteUrl = `${process.env.NEXTAUTH_URL ?? ""}/invite/${inviteToken}`;
  return NextResponse.json({ member, inviteUrl }, { status: 201 });
}
