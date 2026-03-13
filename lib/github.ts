import { Octokit } from "@octokit/rest";
import { db } from "@/lib/db";
import { accounts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { randomBytes } from "crypto";

export async function getGithubClient(userId: string): Promise<Octokit | null> {
  const account = await db.query.accounts.findFirst({
    where: and(eq(accounts.userId, userId), eq(accounts.provider, "github")),
  });

  if (!account?.access_token) return null;

  return new Octokit({ auth: account.access_token });
}

export interface PullRequest {
  number: number;
  title: string;
  body: string | null;
  mergedAt: string;
  url: string;
  labels: string[];
}

export interface Commit {
  sha: string;
  message: string;
  author: string;
  date: string;
}

export async function fetchCommits(
  octokit: Octokit,
  owner: string,
  repo: string,
  since: Date,
  until: Date
): Promise<Commit[]> {
  const commits: Commit[] = [];
  let page = 1;

  while (true) {
    const { data } = await octokit.repos.listCommits({
      owner,
      repo,
      since: since.toISOString(),
      until: until.toISOString(),
      per_page: 100,
      page,
    });

    if (data.length === 0) break;

    for (const c of data) {
      const msg = c.commit.message.split("\n")[0].trim();
      // Skip merge commits
      if (msg.startsWith("Merge ")) continue;
      commits.push({
        sha: c.sha.slice(0, 7),
        message: msg,
        author: c.commit.author?.name ?? "Unknown",
        date: c.commit.author?.date ?? "",
      });
    }

    if (data.length < 100) break;
    page++;
  }

  return commits;
}

export async function fetchMergedPRs(
  octokit: Octokit,
  owner: string,
  repo: string,
  since: Date,
  until: Date
): Promise<PullRequest[]> {
  const prs: PullRequest[] = [];
  let page = 1;

  while (true) {
    const { data } = await octokit.pulls.list({
      owner,
      repo,
      state: "closed",
      sort: "updated",
      direction: "desc",
      per_page: 100,
      page,
    });

    if (data.length === 0) break;

    for (const pr of data) {
      if (!pr.merged_at) continue;
      const mergedAt = new Date(pr.merged_at);
      if (mergedAt < since) {
        // Sorted desc, so we can stop once we're past the since date
        return prs;
      }
      if (mergedAt <= until) {
        // Skip bot PRs (dependabot, renovate, etc.)
        const authorLogin = pr.user?.login ?? "";
        const isBotAuthor =
          pr.user?.type === "Bot" ||
          authorLogin.includes("dependabot") ||
          authorLogin.includes("renovate") ||
          authorLogin.endsWith("[bot]");
        if (isBotAuthor) continue;

        prs.push({
          number: pr.number,
          title: pr.title,
          body: pr.body,
          mergedAt: pr.merged_at,
          url: pr.html_url,
          labels: pr.labels.map((l) => l.name ?? ""),
        });
      }
    }

    page++;
  }

  return prs;
}

export function generateWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}

export async function registerWebhook(
  octokit: Octokit,
  owner: string,
  repo: string,
  webhookUrl: string,
  secret: string
): Promise<number> {
  const { data } = await octokit.repos.createWebhook({
    owner,
    repo,
    config: {
      url: webhookUrl,
      content_type: "json",
      secret,
      insecure_ssl: "0",
    },
    events: ["pull_request"],
    active: true,
  });
  return data.id;
}

export async function deleteWebhook(
  octokit: Octokit,
  owner: string,
  repo: string,
  hookId: number
): Promise<void> {
  await octokit.repos.deleteWebhook({ owner, repo, hook_id: hookId });
}
