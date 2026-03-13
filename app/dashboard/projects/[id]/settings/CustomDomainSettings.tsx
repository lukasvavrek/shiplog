"use client";

import { useState } from "react";

interface Props {
  projectId: string;
  initialDomain: string | null;
  initialToken: string | null;
  initialVerifiedAt: Date | null;
}

export default function CustomDomainSettings({
  projectId,
  initialDomain,
  initialToken,
  initialVerifiedAt,
}: Props) {
  const [domain, setDomain] = useState(initialDomain ?? "");
  const [token, setToken] = useState(initialToken ?? "");
  const [verifiedAt, setVerifiedAt] = useState<Date | null>(initialVerifiedAt);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [verifyResult, setVerifyResult] = useState<"success" | "fail" | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaveError("");
    setVerifyResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customDomain: domain.trim() || null }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSaveError(data.error ?? "Failed to save");
      } else {
        const data = await res.json();
        setToken(data.customDomainToken ?? "");
        setVerifiedAt(data.customDomainVerifiedAt ? new Date(data.customDomainVerifiedAt) : null);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleVerify() {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/custom-domain`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.verified) {
        setVerifiedAt(new Date());
        setVerifyResult("success");
      } else {
        setVerifyResult("fail");
      }
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Custom domain
        </label>
        <p className="mt-0.5 text-xs text-gray-500">
          Serve your changelog at your own domain (e.g.{" "}
          <code className="rounded bg-gray-100 px-1">changelog.yourcompany.com</code>).
        </p>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            placeholder="changelog.yourcompany.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        {saveError && <p className="mt-1 text-xs text-red-600">{saveError}</p>}
      </div>

      {token && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="mb-2 text-sm font-medium text-gray-700">DNS verification</p>
          {verifiedAt ? (
            <p className="text-sm text-green-700">
              ✓ Domain verified on{" "}
              {new Date(verifiedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          ) : (
            <>
              <p className="mb-3 text-xs text-gray-600">
                Add the following DNS records to your domain, then click{" "}
                <strong>Verify</strong>.
              </p>

              <div className="mb-3 space-y-2">
                <div className="rounded border border-gray-200 bg-white p-3 text-xs font-mono">
                  <p className="mb-1 font-sans font-medium text-gray-500">
                    CNAME record (routes traffic)
                  </p>
                  <p>
                    <span className="text-gray-500">Name:</span>{" "}
                    <span className="text-gray-900">{domain}</span>
                  </p>
                  <p>
                    <span className="text-gray-500">Value:</span>{" "}
                    <span className="text-gray-900">cname.shiplog.dev</span>
                  </p>
                </div>

                <div className="rounded border border-gray-200 bg-white p-3 text-xs font-mono">
                  <p className="mb-1 font-sans font-medium text-gray-500">
                    TXT record (ownership verification)
                  </p>
                  <p>
                    <span className="text-gray-500">Name:</span>{" "}
                    <span className="text-gray-900">_shiplog-verify.{domain}</span>
                  </p>
                  <p>
                    <span className="text-gray-500">Value:</span>{" "}
                    <span className="text-gray-900">{token}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={handleVerify}
                disabled={verifying}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white disabled:opacity-50"
              >
                {verifying ? "Checking DNS…" : "Verify domain"}
              </button>
              {verifyResult === "fail" && (
                <p className="mt-2 text-xs text-amber-700">
                  DNS records not found yet. It can take up to 48 hours for DNS to propagate.
                </p>
              )}
              {verifyResult === "success" && (
                <p className="mt-2 text-xs text-green-700">Domain verified!</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
