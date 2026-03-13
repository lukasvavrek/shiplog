import Stripe from "stripe";

export const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || "sk_test_placeholder_build_only"
);

export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    maxProjects: 1,
    maxEntriesPerMonth: 50,
    teamReview: false,
  },
  pro: {
    name: "Pro",
    price: 2900, // cents
    maxProjects: 5,
    maxEntriesPerMonth: Infinity,
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID,
    teamReview: false,
  },
  team: {
    name: "Team",
    price: 7900, // cents
    maxProjects: 20,
    maxEntriesPerMonth: Infinity,
    stripePriceId: process.env.STRIPE_TEAM_PRICE_ID,
    teamReview: true,
  },
} as const;

export type Plan = keyof typeof PLANS;
