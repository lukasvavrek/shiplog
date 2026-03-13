"use client";

import { useState } from "react";

interface TeamMember {
  id: string;
  email: string;
  role: string;
  inviteAcceptedAt: string | null;
  user: { id: string; name: string | null; email: string | null; image: string | null } | null;
}

interface Props {
  projectId: string;
  initialMembers: TeamMember[];
}

export default function TeamSettings({ projectId, initialMembers }: Props) {
  const [members, setMembers] = useState<TeamMember[]>(initialMembers);
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function invite() {
    if (!email.trim()) return;
    setInviting(true);
    setError(null);
    setInviteUrl(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Invite failed");
      setMembers((prev) => [...prev, data.member]);
      setInviteUrl(data.inviteUrl);
      setEmail("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setInviting(false);
    }
  }

  async function removeMember(memberId: string) {
    const res = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
        <p className="mt-1 text-sm text-gray-500">
          Invite reviewers to this project. They can review and approve changelogs before publishing.
        </p>
      </div>

      {/* Invite form */}
      <div className="flex gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && invite()}
          placeholder="reviewer@example.com"
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
        />
        <button
          onClick={invite}
          disabled={inviting || !email.trim()}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {inviting ? "Inviting…" : "Invite"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {inviteUrl && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <p className="mb-1 text-sm font-medium text-green-800">Invite link generated</p>
          <p className="text-xs text-green-700 break-all">
            Share this link with the reviewer:
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 rounded bg-green-100 px-2 py-1 text-xs text-green-900 break-all">
              {inviteUrl}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(inviteUrl)}
              className="rounded border border-green-300 px-2 py-1 text-xs text-green-700 hover:bg-green-100"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {/* Members list */}
      {members.length === 0 ? (
        <p className="text-sm text-gray-400">No team members yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {members.map((member) => (
            <li key={member.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                {member.user?.image && (
                  <img
                    src={member.user.image}
                    alt=""
                    className="h-8 w-8 rounded-full"
                  />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {member.user?.name ?? member.email}
                  </p>
                  <p className="text-xs text-gray-500">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs ${
                    member.inviteAcceptedAt
                      ? "text-green-600"
                      : "text-yellow-600"
                  }`}
                >
                  {member.inviteAcceptedAt ? "Accepted" : "Pending"}
                </span>
                <button
                  onClick={() => removeMember(member.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
