import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getGithubClient, deleteWebhook } from "@/lib/github";

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
