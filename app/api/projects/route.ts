import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { PLANS } from "@/lib/stripe";
import {
  getGithubClient,
  generateWebhookSecret,
  registerWebhook,
} from "@/lib/github";

function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const parsed = new URL(url.trim());
    if (parsed.hostname !== "github.com") return null;
    const parts = parsed.pathname.replace(/^\//, "").replace(/\.git$/, "").split("/");
    if (parts.length < 2 || !parts[0] || !parts[1]) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { repoUrl } = await req.json();
  if (!repoUrl) {
    return NextResponse.json({ error: "repoUrl is required" }, { status: 400 });
  }

  const parsed = parseGithubUrl(repoUrl);
  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid GitHub URL. Expected https://github.com/owner/repo" },
      { status: 400 }
    );
  }

  // Enforce plan limits
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });
  const plan = (user?.plan ?? "free") as keyof typeof PLANS;
  const maxProjects = PLANS[plan].maxProjects;
  const existing = await db.query.projects.findMany({
    where: eq(projects.userId, session.user.id),
  });
  if (existing.length >= maxProjects) {
    return NextResponse.json(
      {
        error: `Your ${plan} plan allows up to ${maxProjects} project(s). Upgrade to add more.`,
      },
      { status: 403 }
    );
  }

  const { owner, repo } = parsed;
  const slug = `${owner}-${repo}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  const projectId = nanoid();
  let webhookId: number | null = null;
  let webhookSecret: string | null = null;

  // Register GitHub webhook for Pro users
  if (plan === "pro") {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const octokit = await getGithubClient(session.user.id);
    if (octokit && appUrl) {
      try {
        webhookSecret = generateWebhookSecret();
        webhookId = await registerWebhook(
          octokit,
          owner,
          repo,
          `${appUrl}/api/webhooks/github`,
          webhookSecret
        );
      } catch {
        // Non-fatal: webhook registration failure doesn't block project creation
        webhookId = null;
        webhookSecret = null;
      }
    }
  }

  const [project] = await db
    .insert(projects)
    .values({
      id: projectId,
      userId: session.user.id,
      githubOwner: owner,
      githubRepo: repo,
      name: repo,
      slug,
      githubWebhookId: webhookId ? String(webhookId) : null,
      githubWebhookSecret: webhookSecret,
    })
    .returning();

  return NextResponse.json(project, { status: 201 });
}
