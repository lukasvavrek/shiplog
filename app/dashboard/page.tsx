import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  const userProjects = await db.query.projects.findMany({
    where: eq(projects.userId, session!.user!.id!),
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Projects</h1>
        <Link
          href="/dashboard/projects/new"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          Connect repo
        </Link>
      </div>

      {userProjects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500">No projects yet.</p>
          <p className="mt-1 text-sm text-gray-400">
            Connect a GitHub repo to get started.
          </p>
          <Link
            href="/dashboard/projects/new"
            className="mt-4 inline-block rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Connect repo
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {userProjects.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/projects/${project.id}`}
              className="rounded-xl border border-gray-200 bg-white p-6 hover:border-gray-300 hover:shadow-sm"
            >
              <h2 className="font-semibold text-gray-900">{project.name}</h2>
              <p className="mt-1 text-sm text-gray-500">
                {project.githubOwner}/{project.githubRepo}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
