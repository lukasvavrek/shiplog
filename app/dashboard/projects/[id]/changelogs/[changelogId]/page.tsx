import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, changelogs, users, changelogReviews } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import ChangelogEditor from "./ChangelogEditor";

export default async function ChangelogPage({
  params,
}: {
  params: Promise<{ id: string; changelogId: string }>;
}) {
  const { id, changelogId } = await params;
  const session = await auth();

  const [project, user] = await Promise.all([
    db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.userId, session!.user!.id!)),
    }),
    db.query.users.findFirst({ where: eq(users.id, session!.user!.id!) }),
  ]);
  if (!project) notFound();

  const changelog = await db.query.changelogs.findFirst({
    where: and(eq(changelogs.id, changelogId), eq(changelogs.projectId, id)),
  });
  if (!changelog) notFound();

  const reviews = await db.query.changelogReviews.findMany({
    where: eq(changelogReviews.changelogId, changelogId),
    with: {
      reviewer: { columns: { id: true, name: true, email: true, image: true } },
    },
    orderBy: (r, { desc }) => [desc(r.createdAt)],
  });

  return (
    <ChangelogEditor
      projectId={id}
      projectName={project.name}
      changelog={changelog}
      isTeamPlan={user?.plan === "team"}
      reviews={reviews as Parameters<typeof ChangelogEditor>[0]["reviews"]}
    />
  );
}
