import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import dns from "dns/promises";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, id), eq(projects.userId, session.user.id)),
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!project.customDomain || !project.customDomainToken) {
    return NextResponse.json(
      { error: "No custom domain configured" },
      { status: 400 }
    );
  }

  if (project.customDomainVerifiedAt) {
    return NextResponse.json({ verified: true });
  }

  // Check TXT record: _shiplog-verify.<domain> = <token>
  const txtHost = `_shiplog-verify.${project.customDomain}`;
  let verified = false;

  try {
    const records = await dns.resolveTxt(txtHost);
    const flat = records.flat();
    verified = flat.some((r) => r === project.customDomainToken);
  } catch {
    // DNS lookup failed — not verified
  }

  if (verified) {
    await db
      .update(projects)
      .set({ customDomainVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(projects.id, id));
  }

  return NextResponse.json({ verified });
}
