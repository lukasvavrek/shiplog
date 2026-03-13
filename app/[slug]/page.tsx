import { db } from "@/lib/db";
import { projects, changelogs } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

export default async function PublicChangelogPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const project = await db.query.projects.findFirst({
    where: eq(projects.slug, slug),
  });

  if (!project) notFound();

  const publishedChangelogs = await db.query.changelogs.findMany({
    where: and(
      eq(changelogs.projectId, project.id),
      eq(changelogs.published, true)
    ),
    orderBy: [desc(changelogs.publishedAt)],
  });

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 py-8">
        <div className="mx-auto max-w-2xl px-6">
          <div className="mb-1 text-xs font-medium uppercase tracking-widest text-gray-400">
            Changelog
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {project.githubOwner}/{project.githubRepo}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10">
        {publishedChangelogs.length === 0 ? (
          <p className="text-gray-400">No changelogs published yet.</p>
        ) : (
          <div className="space-y-12">
            {publishedChangelogs.map((changelog) => (
              <article key={changelog.id}>
                <header className="mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {changelog.title}
                  </h2>
                  {changelog.publishedAt && (
                    <time className="text-sm text-gray-400">
                      {new Date(changelog.publishedAt).toLocaleDateString(
                        "en-US",
                        { year: "numeric", month: "long", day: "numeric" }
                      )}
                    </time>
                  )}
                </header>
                <div className="prose prose-sm prose-gray max-w-none">
                  <ReactMarkdown>{changelog.content}</ReactMarkdown>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-400">
        Powered by{" "}
        <Link href="/" className="hover:text-gray-600">
          ShipLog
        </Link>
      </footer>
    </div>
  );
}
