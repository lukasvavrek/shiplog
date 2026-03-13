"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DisconnectProjectButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDisconnect(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    router.refresh();
  }

  function handleConfirmClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirming(true);
  }

  function handleCancel(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirming(false);
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5" onClick={(e) => e.preventDefault()}>
        <button
          onClick={handleDisconnect}
          disabled={loading}
          className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {loading ? "Removing…" : "Remove"}
        </button>
        <button
          onClick={handleCancel}
          className="rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleConfirmClick}
      className="rounded px-2 py-1 text-xs font-medium text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-100 hover:text-gray-700"
    >
      Remove
    </button>
  );
}
