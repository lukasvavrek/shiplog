import { Octokit } from "@octokit/rest";
import { db } from "@/lib/db";
import { accounts } from "@/db/schema";
import { and, eq } from "drizzle-orm";

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
