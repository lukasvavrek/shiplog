import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, changelogs } from "@/db/schema";
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

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, id), eq(projects.userId, session!.user!.id!)),
  });
  if (!project) notFound();

  const changelog = await db.query.changelogs.findFirst({
    where: and(eq(changelogs.id, changelogId), eq(changelogs.projectId, id)),
  });
  if (!changelog) notFound();

  return (
    <ChangelogEditor
      projectId={id}
      projectName={project.name}
      changelog={changelog}
    />
  );
}
