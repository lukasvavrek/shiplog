import { db } from "@/lib/db";
import { projects, changelogs } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import type { Metadata } from "next";
import ViewTracker from "./ViewTracker";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://shiplog.app";

  return {
    other: {
      // RSS autodiscovery
      "application/atom+xml": `${appUrl}/api/changelog/${slug}/feed`,
    },
  };
}

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

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://shiplog.app";
  const feedUrl = `${appUrl}/api/changelog/${slug}/feed`;

  return (
    <div className="min-h-screen bg-white">
      <ViewTracker slug={slug} />
      <head>
        <link
          rel="alternate"
          type="application/atom+xml"
          title={`${project.name} Changelog`}
          href={feedUrl}
        />
      </head>

      <header className="border-b border-gray-100 py-8">
        <div className="mx-auto max-w-2xl px-6">
          <div className="mb-1 text-xs font-medium uppercase tracking-widest text-gray-400">
            Changelog
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              <p className="mt-1 text-sm text-gray-500">
                {project.githubOwner}/{project.githubRepo}
              </p>
            </div>
            <a
              href={feedUrl}
              title="Subscribe via RSS"
              className="text-gray-400 hover:text-orange-500"
              aria-label="RSS feed"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19.01 7.38 20 6.18 20C4.98 20 4 19.01 4 17.82a2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z" />
              </svg>
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10">
        {publishedChangelogs.length === 0 ? (
          <p className="text-gray-400">No changelogs published yet.</p>
        ) : (
          <div className="space-y-12">
            {publishedChangelogs.map((changelog) => (
              <article key={changelog.id} id={changelog.id}>
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
