"use client";

import { signIn, signOut } from "next-auth/react";

export default function ReconnectGitHub() {
  async function handleReconnect() {
    // Sign out first so GitHub shows the full authorization page (including
    // org access section) instead of auto-approving the existing session.
    await signOut({ redirect: false });
    signIn("github", { callbackUrl: "/dashboard" });
  }

  return (
    <button
      onClick={handleReconnect}
      className="text-sm text-gray-500 hover:text-gray-900"
      title="Re-authorize GitHub to update permissions or grant organization access"
    >
      Reconnect GitHub
    </button>
  );
}
