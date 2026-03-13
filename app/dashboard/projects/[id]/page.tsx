import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, changelogs } from "@/db/schema";
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

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, id), eq(projects.userId, session!.user!.id!)),
  });

  if (!project) notFound();

  const projectChangelogs = await db.query.changelogs.findMany({
    where: eq(changelogs.projectId, project.id),
    orderBy: (c, { desc }) => [desc(c.createdAt)],
  });

  return (
    <div>
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
                  {changelog.published ? "Published" : "Draft"}
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
