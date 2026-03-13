import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";

export default auth(async (req: NextRequest & { auth: unknown }) => {
  const pathname = req.nextUrl.pathname;

  // Custom domain routing: resolve verified custom domains to their slug page.
  // Skip Next.js internals and API routes.
  if (
    !pathname.startsWith("/_next") &&
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/favicon")
  ) {
    const appHost = process.env.NEXT_PUBLIC_APP_URL
      ? new URL(process.env.NEXT_PUBLIC_APP_URL).host
      : null;
    const reqHost = req.headers.get("host") ?? req.nextUrl.host;

    if (
      appHost &&
      reqHost !== appHost &&
      !reqHost.startsWith("localhost") &&
      !reqHost.startsWith("127.0.0.1")
    ) {
      try {
        const sql = neon(process.env.DATABASE_URL!);
        const rows = await sql`
          SELECT slug FROM projects
          WHERE custom_domain = ${reqHost}
            AND custom_domain_verified_at IS NOT NULL
          LIMIT 1
        `;
        if (rows.length > 0) {
          const slug = rows[0].slug as string;
          const url = req.nextUrl.clone();
          url.pathname = `/${slug}`;
          return NextResponse.rewrite(url);
        }
      } catch {
        // DB unavailable — fall through to normal routing
      }
    }
  }

  // Protect dashboard routes
  if (!(req as unknown as { auth: unknown }).auth && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/", req.url));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
