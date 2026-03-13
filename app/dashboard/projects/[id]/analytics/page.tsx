import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, changelogs, pageViews, users } from "@/db/schema";
import { and, eq, gte, sql, desc } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

function TrendChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const width = 600;
  const height = 120;
  const barWidth = Math.floor(width / data.length) - 2;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      aria-label="Views over last 30 days"
    >
      {data.map((d, i) => {
        const barHeight = Math.max(2, (d.count / max) * (height - 20));
        const x = i * (width / data.length);
        const y = height - barHeight;
        return (
          <g key={d.date}>
            <rect
              x={x + 1}
              y={y}
              width={barWidth}
              height={barHeight}
              fill="#6366f1"
              rx={2}
              opacity={0.85}
            />
            {d.count > 0 && (
              <title>
                {d.date}: {d.count} view{d.count !== 1 ? "s" : ""}
              </title>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default async function AnalyticsPage({
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
    db.query.users.findFirst({
      where: eq(users.id, session!.user!.id!),
    }),
  ]);

  if (!project) notFound();

  const isTeam = user?.plan === "team";
  if (!isTeam) {
    redirect(`/dashboard/projects/${id}`);
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Total views for this project
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(pageViews)
    .where(eq(pageViews.projectId, project.id));

  // Views per changelog entry (published only)
  const publishedChangelogs = await db.query.changelogs.findMany({
    where: and(
      eq(changelogs.projectId, project.id),
      eq(changelogs.published, true)
    ),
    orderBy: [desc(changelogs.publishedAt)],
  });

  const viewsPerEntry = await Promise.all(
    publishedChangelogs.map(async (cl) => {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(pageViews)
        .where(eq(pageViews.changelogId, cl.id));
      return { changelog: cl, count };
    })
  );

  // Daily views over last 30 days
  const dailyRows = await db
    .select({
      day: sql<string>`date_trunc('day', viewed_at)::date::text`,
      count: sql<number>`count(*)::int`,
    })
    .from(pageViews)
    .where(
      and(
        eq(pageViews.projectId, project.id),
        gte(pageViews.viewedAt, thirtyDaysAgo)
      )
    )
    .groupBy(sql`date_trunc('day', viewed_at)`)
    .orderBy(sql`date_trunc('day', viewed_at)`);

  // Build full 30-day array filling in zeros
  const dailyMap = new Map(dailyRows.map((r) => [r.day, r.count]));
  const trendData: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    trendData.push({ date: key, count: dailyMap.get(key) ?? 0 });
  }

  return (
    <div>
      <div className="mb-6">
        <nav className="mb-1 text-sm text-gray-500">
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
          / Analytics
        </nav>
        <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {project.githubOwner}/{project.githubRepo}
        </p>
      </div>

      {/* Summary card */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Total page views</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            {total.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Published entries</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            {publishedChangelogs.length}
          </p>
        </div>
      </div>

      {/* Trend chart */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-medium text-gray-700">
          Views — last 30 days
        </h2>
        <TrendChart data={trendData} />
        <div className="mt-2 flex justify-between text-xs text-gray-400">
          <span>{trendData[0]?.date}</span>
          <span>{trendData[trendData.length - 1]?.date}</span>
        </div>
      </div>

      {/* Per-entry table */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-medium text-gray-700">
            Views per changelog entry
          </h2>
        </div>
        {viewsPerEntry.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400">
            No published changelogs yet.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {viewsPerEntry.map(({ changelog, count }) => (
              <li
                key={changelog.id}
                className="flex items-center justify-between px-5 py-3"
              >
                <div>
                  <Link
                    href={`/dashboard/projects/${project.id}/changelogs/${changelog.id}`}
                    className="text-sm font-medium text-gray-900 hover:underline"
                  >
                    {changelog.title}
                  </Link>
                  {changelog.publishedAt && (
                    <p className="text-xs text-gray-400">
                      {new Date(changelog.publishedAt).toLocaleDateString(
                        "en-US",
                        { year: "numeric", month: "short", day: "numeric" }
                      )}
                    </p>
                  )}
                </div>
                <span className="text-sm font-semibold text-gray-700">
                  {count.toLocaleString()}{" "}
                  <span className="font-normal text-gray-400">views</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
