import { db } from "@/lib/db";
import { projects, changelogs } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "5"), 20);

  const project = await db.query.projects.findFirst({
    where: eq(projects.slug, slug),
  });

  if (!project) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: CORS_HEADERS }
    );
  }

  const entries = await db.query.changelogs.findMany({
    where: and(
      eq(changelogs.projectId, project.id),
      eq(changelogs.published, true)
    ),
    orderBy: [desc(changelogs.publishedAt)],
    limit,
  });

  const data = {
    project: {
      name: project.name,
      slug: project.slug,
    },
    entries: entries.map((e) => ({
      id: e.id,
      title: e.title,
      content: e.content,
      publishedAt: (e.publishedAt ?? e.createdAt).toISOString(),
    })),
  };

  return NextResponse.json(data, {
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": "public, max-age=120",
    },
  });
}
