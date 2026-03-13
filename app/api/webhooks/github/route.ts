import { db } from "@/lib/db";
import { projects, changelogs, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { getGithubClient } from "@/lib/github";
import Anthropic from "@anthropic-ai/sdk";
import { nanoid } from "nanoid";

const anthropic = new Anthropic();

function verifySignature(
  body: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

interface PullRequestPayload {
  action: string;
  pull_request: {
    number: number;
    title: string;
    body: string | null;
    merged: boolean;
    merged_at: string | null;
    html_url: string;
    labels: { name: string }[];
    user: {
      login: string;
      type: string;
    };
  };
  repository: {
    name: string;
    owner: {
      login: string;
    };
  };
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  const event = req.headers.get("x-github-event");

  // Only handle pull_request events
  if (event !== "pull_request") {
    return NextResponse.json({ ok: true });
  }

  let payload: PullRequestPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Only process merged PRs
  if (payload.action !== "closed" || !payload.pull_request.merged) {
    return NextResponse.json({ ok: true });
  }

  const { owner, repo } = {
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
  };

  // Find the project by owner/repo
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.githubOwner, owner),
      eq(projects.githubRepo, repo)
    ),
  });

  if (!project || !project.githubWebhookSecret) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Verify webhook signature
  if (!verifySignature(body, signature, project.githubWebhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Check that project owner is on Pro plan
  const user = await db.query.users.findFirst({
    where: eq(users.id, project.userId),
  });

  if (!user || user.plan !== "pro") {
    // Free tier: silently accept the webhook but don't generate
    return NextResponse.json({ ok: true });
  }

  const pr = payload.pull_request;

  // Skip bot PRs
  const isBotAuthor =
    pr.user.type === "Bot" ||
    pr.user.login.includes("dependabot") ||
    pr.user.login.includes("renovate") ||
    pr.user.login.endsWith("[bot]");
  if (isBotAuthor) {
    return NextResponse.json({ ok: true });
  }

  // Get PR details for context (we have them in the payload already)
  const octokit = await getGithubClient(project.userId);
  let prBody = pr.body ?? "";

  // If PR body is short, try to fetch PR diff summary via octokit for richer context
  if (octokit && prBody.length < 100) {
    try {
      const { data: prData } = await octokit.pulls.get({
        owner,
        repo,
        pull_number: pr.number,
      });
      prBody = prData.body ?? prBody;
    } catch {
      // Use what we have
    }
  }

  const labels = pr.labels.map((l) => l.name).join(", ");
  const prDescription = `PR #${pr.number}: ${pr.title}${labels ? ` [${labels}]` : ""}${prBody ? `\n${prBody.slice(0, 500)}` : ""}`;

  const prompt = `You are a product manager writing a customer-facing changelog entry for ${owner}/${repo}.

A pull request was just merged. Transform it into a polished, professional changelog entry that users will actually want to read.

Rules:
- Organize into one of these sections: ## New Features, ## Improvements, or ## Bug Fixes — pick the most appropriate one
- Write 1-3 bullet points from the user's perspective: what they can now do, what got better, or what got fixed
- Use active, benefit-oriented language (e.g. "You can now export reports as CSV" not "Added CSV export endpoint")
- If the PR is trivial (typo fix, dependency bump, CI config) write: SKIP
- Translate technical jargon into plain English
- Each bullet should be 1 sentence, punchy and clear

PR:
${prDescription}

Output only the Markdown changelog content (section header + bullets). No preamble.`;

  let content: string;
  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });
    content =
      message.content[0].type === "text" ? message.content[0].text.trim() : "";
  } catch {
    return NextResponse.json(
      { error: "AI generation failed" },
      { status: 500 }
    );
  }

  // Skip trivial PRs that the AI flagged
  if (content === "SKIP" || content.startsWith("SKIP")) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const mergedAt = pr.merged_at ? new Date(pr.merged_at) : new Date();
  const title = `${project.name} — ${mergedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;

  await db.insert(changelogs).values({
    id: nanoid(),
    projectId: project.id,
    title,
    content,
    published: false,
    dateFrom: mergedAt,
    dateTo: mergedAt,
  });

  return NextResponse.json({ ok: true, generated: true });
}
