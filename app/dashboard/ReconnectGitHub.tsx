"use client";

import { signIn } from "next-auth/react";

export default function ReconnectGitHub() {
  return (
    <button
      onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
      className="text-sm text-gray-500 hover:text-gray-900"
      title="Re-authorize GitHub to update permissions or grant organization access"
    >
      Reconnect GitHub
    </button>
  );
}
