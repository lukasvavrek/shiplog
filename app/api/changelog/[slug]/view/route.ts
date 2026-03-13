import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, pageViews } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const project = await db.query.projects.findFirst({
    where: eq(projects.slug, slug),
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const changelogId = body.changelogId ?? null;
  const referrer = req.headers.get("referer") ?? null;

  await db.insert(pageViews).values({
    id: nanoid(),
    projectId: project.id,
    changelogId,
    viewedAt: new Date(),
    referrer: referrer ? referrer.slice(0, 500) : null,
    country: null,
  });

  return NextResponse.json({ ok: true });
}
