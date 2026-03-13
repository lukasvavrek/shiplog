import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, changelogs } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getGithubClient, fetchMergedPRs, fetchCommits } from "@/lib/github";
import Anthropic from "@anthropic-ai/sdk";
import { nanoid } from "nanoid";
import { checkRateLimit } from "@/lib/rate-limit";

const anthropic = new Anthropic();

// 10 requests per user per minute
const GENERATE_RATE_LIMIT = { limit: 10, windowMs: 60_000 };

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = checkRateLimit(
    `generate:${session.user.id}`,
    GENERATE_RATE_LIMIT.limit,
    GENERATE_RATE_LIMIT.windowMs
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before generating again." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Limit": String(GENERATE_RATE_LIMIT.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(rl.resetAt),
        },
      }
    );
  }

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, id), eq(projects.userId, session.user.id)),
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await req.json();
  const { since, until, title } = body as {
    since: string;
    until: string;
    title?: string;
  };

  if (!since || !until) {
    return NextResponse.json(
      { error: "since and until dates are required" },
      { status: 400 }
    );
  }

  const octokit = await getGithubClient(session.user.id);
  if (!octokit) {
    return NextResponse.json(
      { error: "GitHub account not connected" },
      { status: 400 }
    );
  }

  let prs;
  try {
    prs = await fetchMergedPRs(
      octokit,
      project.githubOwner,
      project.githubRepo,
      new Date(since),
      new Date(until)
    );
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "status" in err &&
      (err as { status: number }).status === 403 &&
      "message" in err &&
      typeof (err as { message: string }).message === "string" &&
      (err as { message: string }).message.includes("OAuth App access restrictions")
    ) {
      return NextResponse.json(
        {
          error:
            "This organization has restricted OAuth App access. Re-authorize your GitHub connection to grant access.",
          code: "github_org_access_required",
        },
        { status: 403 }
      );
    }
    throw err;
  }

  let prompt: string;

  if (prs.length > 0) {
    const prList = prs
      .map(
        (pr) =>
          `PR #${pr.number}: ${pr.title}${pr.labels.length ? ` [${pr.labels.join(", ")}]` : ""}${pr.body ? `\n${pr.body.slice(0, 500)}` : ""}`
      )
      .join("\n\n");

    prompt = `You are a product manager writing a customer-facing changelog for ${project.githubOwner}/${project.githubRepo}.

Below are merged pull requests from ${since} to ${until}. Transform them into a polished, professional changelog that users will actually want to read.

Rules:
- Organize into sections: ## New Features, ## Improvements, ## Bug Fixes — only include sections with content
- Write each entry as a single bullet point from the user's perspective: what they can now do, what got better, or what got fixed
- Use active, benefit-oriented language (e.g. "You can now export reports as CSV" not "Added CSV export endpoint")
- Skip or combine trivial PRs (typos, dependency bumps, internal tooling, CI config)
- If a PR title/description is technical jargon, translate it into plain English
- Each bullet should be 1 sentence, punchy and clear

PRs:
${prList}

Output only the Markdown changelog content. No preamble, no intro paragraph.`;
  } else {
    // Fallback: use commits when no PRs found (e.g. repos that commit directly to main)
    let commits;
    try {
      commits = await fetchCommits(
        octokit,
        project.githubOwner,
        project.githubRepo,
        new Date(since),
        new Date(until)
      );
    } catch (err: unknown) {
      if (
        typeof err === "object" &&
        err !== null &&
        "status" in err &&
        (err as { status: number }).status === 403 &&
        "message" in err &&
        typeof (err as { message: string }).message === "string" &&
        (err as { message: string }).message.includes("OAuth App access restrictions")
      ) {
        return NextResponse.json(
          {
            error:
              "This organization has restricted OAuth App access. Re-authorize your GitHub connection to grant access.",
            code: "github_org_access_required",
          },
          { status: 403 }
        );
      }
      throw err;
    }

    if (commits.length === 0) {
      return NextResponse.json(
        { error: "No merged PRs or commits found in this date range" },
        { status: 400 }
      );
    }

    const commitList = commits
      .map((c) => `${c.sha}: ${c.message}`)
      .join("\n");

    prompt = `You are a product manager writing a customer-facing changelog for ${project.githubOwner}/${project.githubRepo}.

Below are git commits from ${since} to ${until}. Transform them into a polished, professional changelog that users will actually want to read.

Rules:
- Organize into sections: ## New Features, ## Improvements, ## Bug Fixes — only include sections with content
- Write each entry as a single bullet point from the user's perspective: what they can now do, what got better, or what got fixed
- Use active, benefit-oriented language (e.g. "You can now export reports as CSV" not "Added CSV export")
- Skip chore/build/infra commits that don't affect users (e.g. "fix CI", "bump deps", "update lockfile")
- Translate technical commit messages into plain English
- Each bullet should be 1 sentence, punchy and clear

Commits:
${commitList}

Output only the Markdown changelog content. No preamble, no intro paragraph.`;
  }

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const content =
    message.content[0].type === "text" ? message.content[0].text : "";

  const changelogTitle =
    title ||
    `${project.name} changelog — ${new Date(since).toLocaleDateString()} to ${new Date(until).toLocaleDateString()}`;

  const [changelog] = await db
    .insert(changelogs)
    .values({
      id: nanoid(),
      projectId: project.id,
      title: changelogTitle,
      content,
      published: false,
      dateFrom: new Date(since),
      dateTo: new Date(until),
    })
    .returning();

  return NextResponse.json(changelog, { status: 201 });
}
