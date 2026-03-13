import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, changelogs, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import DeleteProjectButton from "./DeleteProjectButton";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const [project, user] = await Promise.all([
    db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.userId, session!.user!.id!)),
    }),
    db.query.users.findFirst({
      where: eq(users.id, session!.user!.id!),
    }),
  ]);

  if (!project) notFound();

  const projectChangelogs = await db.query.changelogs.findMany({
    where: eq(changelogs.projectId, project.id),
    orderBy: (c, { desc }) => [desc(c.createdAt)],
  });

  const isPro = user?.plan === "pro" || user?.plan === "team";
  const isTeam = user?.plan === "team";
  const draftCount = projectChangelogs.filter((c) => !c.published).length;
  const inReviewCount = projectChangelogs.filter((c) => c.reviewStatus === "in_review").length;
  const hasWebhook = !!project.githubWebhookId;

  return (
    <div>
      {isTeam && inReviewCount > 0 && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {inReviewCount === 1
            ? "1 changelog is awaiting reviewer approval."
            : `${inReviewCount} changelogs are awaiting reviewer approval.`}
        </div>
      )}

      {isPro && !isTeam && draftCount > 0 && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {draftCount === 1
            ? "1 draft changelog is ready for review."
            : `${draftCount} draft changelogs are ready for review.`}{" "}
          Scroll down to publish.
        </div>
      )}

      {!isPro && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          <span className="font-medium">Pro feature:</span> Auto-generate a
          changelog draft every time a PR merges on GitHub.{" "}
          <Link
            href="/dashboard/billing"
            className="font-medium text-gray-900 underline hover:text-gray-700"
          >
            Upgrade to Pro
          </Link>
        </div>
      )}

      {isPro && !isTeam && (
        <div className="mb-6 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-800">
          <span className="font-medium">Team feature:</span> Invite reviewers to
          approve changelogs before publishing.{" "}
          <Link
            href="/dashboard/billing"
            className="font-medium text-purple-900 underline hover:text-purple-700"
          >
            Upgrade to Team
          </Link>
        </div>
      )}

      {isPro && !hasWebhook && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          GitHub webhook not connected. Auto-generation on PR merge is
          unavailable for this project. Delete and reconnect the repo to enable
          it.
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <nav className="mb-1 text-sm text-gray-500">
            <Link href="/dashboard" className="hover:text-gray-900">
              Projects
            </Link>{" "}
            / {project.name}
          </nav>
          <h1 className="text-2xl font-semibold text-gray-900">
            {project.name}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {project.githubOwner}/{project.githubRepo}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DeleteProjectButton projectId={project.id} />
          {isTeam && (
            <Link
              href={`/dashboard/projects/${project.id}/settings`}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Team settings
            </Link>
          )}
          <Link
            href={`/dashboard/projects/${project.id}/generate`}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Generate changelog
          </Link>
        </div>
      </div>

      {projectChangelogs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500">No changelogs yet.</p>
          <p className="mt-1 text-sm text-gray-400">
            Generate your first changelog from merged PRs or commits.
          </p>
          <Link
            href={`/dashboard/projects/${project.id}/generate`}
            className="mt-4 inline-block rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Generate changelog
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {projectChangelogs.map((changelog) => (
            <Link
              key={changelog.id}
              href={`/dashboard/projects/${project.id}/changelogs/${changelog.id}`}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5 hover:border-gray-300 hover:shadow-sm"
            >
              <div>
                <h2 className="font-medium text-gray-900">{changelog.title}</h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  {changelog.published
                    ? "Published"
                    : changelog.reviewStatus === "in_review"
                    ? "In Review"
                    : changelog.reviewStatus === "approved"
                    ? "Approved"
                    : "Draft"}
                </p>
              </div>
              <span className="text-sm text-gray-400">
                {new Date(changelog.createdAt).toLocaleDateString()}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
