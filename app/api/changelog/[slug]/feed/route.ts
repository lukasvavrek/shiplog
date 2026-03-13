import { db } from "@/lib/db";
import { projects, changelogs } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const project = await db.query.projects.findFirst({
    where: eq(projects.slug, slug),
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const entries = await db.query.changelogs.findMany({
    where: and(
      eq(changelogs.projectId, project.id),
      eq(changelogs.published, true)
    ),
    orderBy: [desc(changelogs.publishedAt)],
    limit: 50,
  });

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://shiplog.app";
  const feedUrl = `${appUrl}/${slug}`;
  const atomFeedUrl = `${appUrl}/api/changelog/${slug}/feed`;
  const now = new Date().toISOString();

  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const items = entries
    .map((entry) => {
      const published = (entry.publishedAt ?? entry.createdAt).toISOString();
      const entryUrl = `${feedUrl}#${entry.id}`;
      return `  <entry>
    <id>${escape(entryUrl)}</id>
    <title>${escape(entry.title)}</title>
    <link href="${escape(entryUrl)}"/>
    <updated>${published}</updated>
    <published>${published}</published>
    <content type="text">${escape(entry.content)}</content>
  </entry>`;
    })
    .join("\n");

  const atom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${escape(feedUrl)}</id>
  <title>${escape(project.name)} Changelog</title>
  <link href="${escape(feedUrl)}"/>
  <link rel="self" type="application/atom+xml" href="${escape(atomFeedUrl)}"/>
  <updated>${entries[0] ? (entries[0].publishedAt ?? entries[0].createdAt).toISOString() : now}</updated>
  <author><name>${escape(project.githubOwner)}</name></author>
${items}
</feed>`;

  return new NextResponse(atom, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
