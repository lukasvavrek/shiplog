"use client";

import { useState } from "react";

export default function UpgradeButton({ isManage = false }: { isManage?: boolean }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const endpoint = isManage ? "/api/billing/portal" : "/api/billing/checkout";
    const res = await fetch(endpoint, { method: "POST" });
    const { url } = await res.json();
    if (url) window.location.href = url;
    else setLoading(false);
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
    >
      {loading
        ? "Redirecting…"
        : isManage
          ? "Manage subscription"
          : "Upgrade to Pro — $29/mo"}
    </button>
  );
}
