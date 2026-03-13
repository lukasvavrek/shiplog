"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Changelog {
  id: string;
  title: string;
  content: string;
  published: boolean;
  publishedAt: Date | null;
  projectId: string;
}

interface Props {
  projectId: string;
  projectName: string;
  changelog: Changelog;
}

export default function ChangelogEditor({
  projectId,
  projectName,
  changelog: initial,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [content, setContent] = useState(initial.content);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiBase = `/api/projects/${projectId}/changelogs/${initial.id}`;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(apiBase, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    setPublishing(true);
    setError(null);
    try {
      // Save first, then publish
      const res = await fetch(apiBase, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, published: true }),
      });
      if (!res.ok) throw new Error("Publish failed");
      router.push(`/dashboard/projects/${projectId}`);
      router.refresh();
    } catch {
      setError("Failed to publish");
      setPublishing(false);
    }
  }

  return (
    <div>
      <nav className="mb-4 text-sm text-gray-500">
        <button
          onClick={() => router.push(`/dashboard/projects/${projectId}`)}
          className="hover:text-gray-900"
        >
          ← {projectName}
        </button>
      </nav>

      <div className="mb-4 flex items-center justify-between">
        <div>
          {initial.published ? (
            <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
              Published
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-yellow-50 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
              Draft
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {error && <span className="text-sm text-red-600">{error}</span>}
          {saved && (
            <span className="text-sm text-gray-500">Saved</span>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save draft"}
          </button>
          {!initial.published && (
            <button
              onClick={publish}
              disabled={publishing}
              className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {publishing ? "Publishing…" : "Publish"}
            </button>
          )}
        </div>
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="mb-4 w-full rounded-lg border border-gray-200 px-4 py-2.5 text-xl font-semibold text-gray-900 focus:border-gray-400 focus:outline-none"
      />

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={28}
        className="w-full rounded-lg border border-gray-200 px-4 py-3 font-mono text-sm text-gray-700 focus:border-gray-400 focus:outline-none"
        placeholder="Your changelog content in Markdown…"
      />
    </div>
  );
}
