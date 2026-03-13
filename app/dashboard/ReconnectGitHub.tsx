"use client";

import { signIn, signOut } from "next-auth/react";

export default function ReconnectGitHub() {
  async function handleReconnect() {
    // Revoke the GitHub token server-side so GitHub is forced to show the
    // full authorization page (including org access) on the next OAuth flow.
    await fetch("/api/auth/revoke-github", { method: "POST" });
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
