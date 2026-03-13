"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { signIn } from "next-auth/react";

function defaultDates() {
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - 30);
  return {
    since: since.toISOString().slice(0, 10),
    until: until.toISOString().slice(0, 10),
  };
}

export default function GenerateChangelogPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const defaults = defaultDates();
  const [since, setSince] = useState(defaults.since);
  const [until, setUntil] = useState(defaults.until);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setErrorCode(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/projects/${params.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ since, until, title: title || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorCode(data.code ?? null);
        throw new Error(data.error || "Generation failed");
      }
      router.push(`/dashboard/projects/${params.id}/changelogs/${data.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <nav className="mb-1 text-sm text-gray-500">
        <button onClick={() => router.back()} className="hover:text-gray-900">
          ← Back
        </button>
      </nav>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">
        Generate changelog
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="since"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              From
            </label>
            <input
              id="since"
              type="date"
              value={since}
              onChange={(e) => setSince(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="until"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              To
            </label>
            <input
              id="until"
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="title"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Title{" "}
            <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            id="title"
            type="text"
            placeholder="e.g. v2.1 Release Notes"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>
        {error && errorCode === "github_org_access_required" ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">{error}</p>
            <button
              type="button"
              onClick={() =>
                signIn("github", { callbackUrl: window.location.href })
              }
              className="mt-3 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
            >
              Re-authorize GitHub
            </button>
          </div>
        ) : (
          error && <p className="text-sm text-red-600">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {loading ? "Generating…" : "Generate with AI"}
        </button>
        {loading && (
          <p className="text-sm text-gray-500">
            Fetching PRs and generating changelog — this may take 15-30 seconds…
          </p>
        )}
      </form>
    </div>
  );
}
