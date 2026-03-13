import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import DisconnectProjectButton from "./DisconnectProjectButton";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const { upgraded } = await searchParams;
  const session = await auth();
  const [userProjects, user] = await Promise.all([
    db.query.projects.findMany({
      where: eq(projects.userId, session!.user!.id!),
      orderBy: (p, { desc }) => [desc(p.createdAt)],
    }),
    db.query.users.findFirst({
      where: eq(users.id, session!.user!.id!),
    }),
  ]);

  const isPro = user?.plan === "pro";

  return (
    <div>
      {upgraded === "1" && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          You&apos;re now on the Pro plan. Enjoy unlimited changelogs and up to 5 projects!
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Projects</h1>
          {isPro && (
            <span className="mt-1 inline-block rounded-full bg-gray-900 px-2 py-0.5 text-xs font-medium text-white">
              Pro
            </span>
          )}
        </div>
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
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {userProjects.map((project) => (
              <div key={project.id} className="group relative">
                <Link
                  href={`/dashboard/projects/${project.id}`}
                  className="block rounded-xl border border-gray-200 bg-white p-6 hover:border-gray-300 hover:shadow-sm"
                >
                  <h2 className="font-semibold text-gray-900">{project.name}</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    {project.githubOwner}/{project.githubRepo}
                  </p>
                </Link>
                <div className="absolute right-3 top-3">
                  <DisconnectProjectButton projectId={project.id} />
                </div>
              </div>
            ))}
          </div>
          {!isPro && (
            <p className="mt-4 text-sm text-gray-400">
              Free plan: 1 project.{" "}
              <Link href="/dashboard/billing" className="underline hover:text-gray-700">
                Upgrade to Pro
              </Link>{" "}
              for up to 5 projects.
            </p>
          )}
        </>
      )}
    </div>
  );
}
