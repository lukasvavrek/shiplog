import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, teamMembers, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import TeamSettings from "./TeamSettings";

export default async function ProjectSettingsPage({
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
    db.query.users.findFirst({ where: eq(users.id, session!.user!.id!) }),
  ]);

  if (!project) notFound();

  const isTeam = user?.plan === "team";

  const members = isTeam
    ? await db.query.teamMembers.findMany({
        where: eq(teamMembers.projectId, id),
        with: {
          user: { columns: { id: true, name: true, email: true, image: true } },
        },
        orderBy: (m, { asc }) => [asc(m.createdAt)],
      })
    : [];

  return (
    <div>
      <nav className="mb-4 text-sm text-gray-500">
        <Link href="/dashboard" className="hover:text-gray-900">
          Projects
        </Link>{" "}
        /{" "}
        <Link
          href={`/dashboard/projects/${project.id}`}
          className="hover:text-gray-900"
        >
          {project.name}
        </Link>{" "}
        / Settings
      </nav>

      <h1 className="mb-6 text-2xl font-semibold text-gray-900">
        Project Settings
      </h1>

      {!isTeam ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <p className="text-gray-600">
            Team review workflow is a{" "}
            <span className="font-medium">Team plan</span> feature ($79/mo).
          </p>
          <Link
            href="/dashboard/billing"
            className="mt-4 inline-block rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Upgrade to Team
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <TeamSettings
            projectId={project.id}
            initialMembers={members as Parameters<typeof TeamSettings>[0]["initialMembers"]}
          />
        </div>
      )}
    </div>
  );
}
