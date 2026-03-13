import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, teamMembers, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import TeamSettings from "./TeamSettings";
import CustomDomainSettings from "./CustomDomainSettings";

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

  const isPro = user?.plan === "pro" || user?.plan === "team";
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

      {/* Custom domain — Pro plan feature */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">
          Custom domain{" "}
          <span className="ml-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
            Pro
          </span>
        </h2>
        {!isPro ? (
          <div className="text-sm text-gray-600">
            Custom domains are a{" "}
            <span className="font-medium">Pro plan</span> feature.{" "}
            <Link
              href="/dashboard/billing"
              className="font-medium text-gray-900 underline hover:text-gray-700"
            >
              Upgrade to Pro
            </Link>
          </div>
        ) : (
          <CustomDomainSettings
            projectId={project.id}
            initialDomain={project.customDomain ?? null}
            initialToken={project.customDomainToken ?? null}
            initialVerifiedAt={project.customDomainVerifiedAt ?? null}
          />
        )}
      </div>

      {/* Team review workflow — Team plan feature */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">
          Team review workflow{" "}
          <span className="ml-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
            Team
          </span>
        </h2>
        {!isTeam ? (
          <div className="text-sm text-gray-600">
            Team review workflow is a{" "}
            <span className="font-medium">Team plan</span> feature ($79/mo).{" "}
            <Link
              href="/dashboard/billing"
              className="font-medium text-gray-900 underline hover:text-gray-700"
            >
              Upgrade to Team
            </Link>
          </div>
        ) : (
          <TeamSettings
            projectId={project.id}
            initialMembers={members as Parameters<typeof TeamSettings>[0]["initialMembers"]}
          />
        )}
      </div>
    </div>
  );
}
