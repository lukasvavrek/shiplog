import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getGithubClient, deleteWebhook } from "@/lib/github";
import { nanoid } from "nanoid";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [project, user] = await Promise.all([
    db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.userId, session.user.id)),
    }),
    db.query.users.findFirst({ where: eq(users.id, session.user.id) }),
  ]);

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isPro = user?.plan === "pro" || user?.plan === "team";
  if (!isPro) {
    return NextResponse.json({ error: "Pro plan required" }, { status: 403 });
  }

  const body = await req.json();
  const { customDomain } = body as { customDomain?: string | null };

  if (customDomain !== undefined) {
    const domain = customDomain?.trim().toLowerCase() || null;
    // If changing domain, reset verification and generate a new token
    const tokenChanged = domain !== project.customDomain;
    await db
      .update(projects)
      .set({
        customDomain: domain,
        customDomainVerifiedAt: tokenChanged ? null : project.customDomainVerifiedAt,
        customDomainToken: tokenChanged && domain ? `shiplog-verify=${nanoid(24)}` : project.customDomainToken,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id));

    const updated = await db.query.projects.findFirst({ where: eq(projects.id, id) });
    return NextResponse.json({ customDomain: updated?.customDomain, customDomainToken: updated?.customDomainToken, customDomainVerifiedAt: updated?.customDomainVerifiedAt });
  }

  return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, id), eq(projects.userId, session.user.id)),
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Clean up GitHub webhook if registered
  if (project.githubWebhookId) {
    const octokit = await getGithubClient(session.user.id);
    if (octokit) {
      try {
        await deleteWebhook(
          octokit,
          project.githubOwner,
          project.githubRepo,
          Number(project.githubWebhookId)
        );
      } catch {
        // Non-fatal: continue with deletion even if webhook cleanup fails
      }
    }
  }

  await db
    .delete(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, session.user.id)));

  return new NextResponse(null, { status: 204 });
}
