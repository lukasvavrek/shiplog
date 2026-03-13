import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import UpgradeButton from "./UpgradeButton";

export default async function BillingPage() {
  const session = await auth();
  const user = await db.query.users.findFirst({
    where: eq(users.id, session!.user!.id!),
  });

  const isPro = user?.plan === "pro";

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Billing</h1>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">
              {isPro ? "Pro" : "Free"} plan
            </p>
            <p className="text-sm text-gray-500">
              {isPro ? "$29/month" : "Free forever"}
            </p>
          </div>
          {isPro && (
            <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
              Active
            </span>
          )}
        </div>

        {!isPro && (
          <div className="mb-4 rounded-lg bg-gray-50 p-4">
            <p className="mb-2 text-sm font-medium text-gray-900">
              Upgrade to Pro
            </p>
            <ul className="mb-4 space-y-1 text-sm text-gray-600">
              <li>✓ Up to 5 projects</li>
              <li>✓ Unlimited changelog entries</li>
              <li>✓ Remove ShipLog branding</li>
            </ul>
            <UpgradeButton />
          </div>
        )}

        {isPro && <UpgradeButton isManage />}
      </div>
    </div>
  );
}
