"use client";

import { useEffect } from "react";

export default function ViewTracker({
  slug,
  changelogId,
}: {
  slug: string;
  changelogId?: string;
}) {
  useEffect(() => {
    fetch(`/api/changelog/${slug}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changelogId: changelogId ?? null }),
    }).catch(() => {});
  }, [slug, changelogId]);

  return null;
}
