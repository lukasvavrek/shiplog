import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, changelogs } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getGithubClient, fetchMergedPRs } from "@/lib/github";
import Anthropic from "@anthropic-ai/sdk";
import { nanoid } from "nanoid";

const anthropic = new Anthropic();

export async function POST(
  req: Request,
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

  const prs = await fetchMergedPRs(
    octokit,
    project.githubOwner,
    project.githubRepo,
    new Date(since),
    new Date(until)
  );

  if (prs.length === 0) {
    return NextResponse.json(
      { error: "No merged PRs found in this date range" },
      { status: 400 }
    );
  }

  const prList = prs
    .map(
      (pr) =>
        `PR #${pr.number}: ${pr.title}${pr.labels.length ? ` [${pr.labels.join(", ")}]` : ""}${pr.body ? `\n${pr.body.slice(0, 500)}` : ""}`
    )
    .join("\n\n");

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are writing a customer-facing changelog for ${project.githubOwner}/${project.githubRepo}.

Below are the merged pull requests from ${since} to ${until}. Convert them into a polished, user-friendly changelog in Markdown format.

Guidelines:
- Organize entries into sections: ## Features, ## Improvements, ## Bug Fixes (only include sections that have content)
- Each entry should be one short bullet point written for non-technical users
- Focus on what changed and why it matters, not how it was implemented
- Skip internal/infra PRs that don't affect users (e.g., "bump dependencies", "update CI")
- Be concise and clear

PRs:
${prList}

Output only the Markdown changelog content, no preamble.`,
      },
    ],
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
