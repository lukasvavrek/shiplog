import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/db/schema";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const parsed = new URL(url.trim());
    if (parsed.hostname !== "github.com") return null;
    const parts = parsed.pathname.replace(/^\//, "").replace(/\.git$/, "").split("/");
    if (parts.length < 2 || !parts[0] || !parts[1]) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { repoUrl } = await req.json();
  if (!repoUrl) {
    return NextResponse.json({ error: "repoUrl is required" }, { status: 400 });
  }

  const parsed = parseGithubUrl(repoUrl);
  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid GitHub URL. Expected https://github.com/owner/repo" },
      { status: 400 }
    );
  }

  const { owner, repo } = parsed;
  const slug = `${owner}-${repo}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  const [project] = await db
    .insert(projects)
    .values({
      id: nanoid(),
      userId: session.user.id,
      githubOwner: owner,
      githubRepo: repo,
      name: repo,
      slug,
    })
    .returning();

  return NextResponse.json(project, { status: 201 });
}
