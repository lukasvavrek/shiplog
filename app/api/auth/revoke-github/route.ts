import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { accounts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await db.query.accounts.findFirst({
    where: and(
      eq(accounts.userId, session.user.id),
      eq(accounts.provider, "github")
    ),
  });

  if (!account?.access_token) {
    return NextResponse.json({ ok: true });
  }

  // Revoke the token via GitHub API so GitHub is forced to show the full
  // authorization page (including org access) on the next OAuth flow.
  // Uses HTTP Basic auth: client_id as username, client_secret as password.
  const clientId = process.env.GITHUB_CLIENT_ID!;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET!;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  await fetch(`https://api.github.com/applications/${clientId}/token`, {
    method: "DELETE",
    headers: {
      Authorization: `Basic ${credentials}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ access_token: account.access_token }),
  });
  // Ignore GitHub revocation errors — even if it fails, the user will be
  // signed out and prompted to re-authorize.

  // Remove the linked account from our DB so NextAuth treats the next
  // sign-in as a fresh authorization.
  await db
    .delete(accounts)
    .where(
      and(
        eq(accounts.userId, session.user.id),
        eq(accounts.provider, "github")
      )
    );

  return NextResponse.json({ ok: true });
}
