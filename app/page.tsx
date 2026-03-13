import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function Home() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6">
      <div className="max-w-2xl text-center">
        <h1 className="mb-4 text-5xl font-bold tracking-tight text-gray-900">ShipLog</h1>
        <p className="mb-8 text-xl text-gray-600">
          Turn your GitHub activity into customer-facing changelogs — automatically.
        </p>
        <p className="mb-10 text-gray-500">
          Connect a repo. We read your merged PRs and generate polished release notes your
          customers can actually understand.
        </p>
        <Link
          href="/api/auth/signin"
          className="rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-gray-700"
        >
          Sign in with GitHub
        </Link>
      </div>

      <div className="mt-20 grid max-w-3xl grid-cols-1 gap-6 text-left sm:grid-cols-3">
        <div className="rounded-xl border border-gray-100 p-6">
          <div className="mb-2 text-2xl">🔗</div>
          <h3 className="mb-1 font-semibold text-gray-900">Connect a repo</h3>
          <p className="text-sm text-gray-500">Link your GitHub repo in one click via OAuth.</p>
        </div>
        <div className="rounded-xl border border-gray-100 p-6">
          <div className="mb-2 text-2xl">✨</div>
          <h3 className="mb-1 font-semibold text-gray-900">AI generates notes</h3>
          <p className="text-sm text-gray-500">
            Claude reads your PRs and writes a categorized changelog draft.
          </p>
        </div>
        <div className="rounded-xl border border-gray-100 p-6">
          <div className="mb-2 text-2xl">🚀</div>
          <h3 className="mb-1 font-semibold text-gray-900">Publish instantly</h3>
          <p className="text-sm text-gray-500">
            Review, edit, and publish to your public changelog page.
          </p>
        </div>
      </div>
    </main>
  );
}
