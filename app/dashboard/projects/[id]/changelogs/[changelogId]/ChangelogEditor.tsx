"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Review {
  id: string;
  status: string;
  comment: string | null;
  reviewer: { id: string; name: string | null; email: string | null; image: string | null };
  createdAt: Date | string;
}

interface Changelog {
  id: string;
  title: string;
  content: string;
  published: boolean;
  publishedAt: Date | null;
  projectId: string;
  reviewStatus: string;
}

interface Props {
  projectId: string;
  projectName: string;
  changelog: Changelog;
  isTeamPlan?: boolean;
  reviews?: Review[];
}

const REVIEW_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-yellow-50 text-yellow-700" },
  in_review: { label: "In Review", color: "bg-blue-50 text-blue-700" },
  approved: { label: "Approved", color: "bg-green-50 text-green-700" },
  published: { label: "Published", color: "bg-gray-100 text-gray-700" },
};

export default function ChangelogEditor({
  projectId,
  projectName,
  changelog: initial,
  isTeamPlan = false,
  reviews: initialReviews = [],
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [content, setContent] = useState(initial.content);
  const [reviewStatus, setReviewStatus] = useState(initial.reviewStatus);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [requestingReview, setRequestingReview] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviews] = useState<Review[]>(initialReviews);

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

  async function requestReview() {
    setRequestingReview(true);
    setError(null);
    try {
      // Save first, then request review
      const res = await fetch(apiBase, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, requestReview: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to request review");
      }
      setReviewStatus("in_review");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to request review");
    } finally {
      setRequestingReview(false);
    }
  }

  async function publish() {
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(apiBase, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, published: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Publish failed");
      }
      router.push(`/dashboard/projects/${projectId}`);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to publish");
      setPublishing(false);
    }
  }

  const statusInfo = REVIEW_STATUS_LABELS[reviewStatus] ?? REVIEW_STATUS_LABELS.draft;
  const canPublish = !initial.published && (!isTeamPlan || reviewStatus === "approved");
  const canRequestReview = isTeamPlan && reviewStatus === "draft";

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
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.color}`}
          >
            {statusInfo.label}
          </span>
          {isTeamPlan && reviewStatus === "in_review" && (
            <span className="text-xs text-gray-500">
              Awaiting reviewer approval
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {error && <span className="text-sm text-red-600">{error}</span>}
          {saved && <span className="text-sm text-gray-500">Saved</span>}
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save draft"}
          </button>
          {canRequestReview && (
            <button
              onClick={requestReview}
              disabled={requestingReview}
              className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              {requestingReview ? "Sending…" : "Request review"}
            </button>
          )}
          {canPublish && (
            <button
              onClick={publish}
              disabled={publishing}
              className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {publishing ? "Publishing…" : "Publish"}
            </button>
          )}
          {isTeamPlan && reviewStatus === "in_review" && !initial.published && (
            <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-500">
              Awaiting approval to publish
            </span>
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

      {/* Reviews panel (Team plan only) */}
      {isTeamPlan && reviews.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Reviews</h3>
          <ul className="space-y-3">
            {reviews.map((review) => (
              <li
                key={review.id}
                className="rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {review.reviewer.image && (
                      <img
                        src={review.reviewer.image}
                        alt=""
                        className="h-6 w-6 rounded-full"
                      />
                    )}
                    <span className="text-sm font-medium text-gray-900">
                      {review.reviewer.name ?? review.reviewer.email}
                    </span>
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      review.status === "approved"
                        ? "text-green-600"
                        : "text-orange-600"
                    }`}
                  >
                    {review.status === "approved" ? "Approved" : "Changes requested"}
                  </span>
                </div>
                {review.comment && (
                  <p className="mt-2 text-sm text-gray-600">{review.comment}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
