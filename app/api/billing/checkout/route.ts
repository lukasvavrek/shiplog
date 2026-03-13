import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { stripe, PLANS } from "@/lib/stripe";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

// 5 requests per user per 10 minutes
const CHECKOUT_RATE_LIMIT = { limit: 5, windowMs: 10 * 60_000 };

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Billing not configured" },
      { status: 503 }
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Accept optional plan param: 'pro' (default) or 'team'
  let targetPlan: "pro" | "team" = "pro";
  try {
    const body = await req.json().catch(() => ({}));
    if (body.plan === "team") targetPlan = "team";
  } catch {
    // ignore
  }

  const rl = checkRateLimit(
    `billing-checkout:${session.user.id}`,
    CHECKOUT_RATE_LIMIT.limit,
    CHECKOUT_RATE_LIMIT.windowMs
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Limit": String(CHECKOUT_RATE_LIMIT.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(rl.resetAt),
        },
      }
    );
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Create or reuse Stripe customer
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await db
      .update(users)
      .set({ stripeCustomerId: customerId })
      .where(eq(users.id, user.id));
  }

  const priceId =
    targetPlan === "team"
      ? process.env.STRIPE_TEAM_PRICE_ID!
      : process.env.STRIPE_PRO_PRICE_ID!;

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
