import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teamMembers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const session = await auth();

  if (!session?.user?.id || !session.user.email) {
    // Redirect to sign-in with the invite link as callback
    redirect(`/api/auth/signin?callbackUrl=/invite/${token}`);
  }

  const member = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.inviteToken, token),
  });

  if (!member) {
    redirect("/dashboard?invite=invalid");
  }

  if (member.inviteAcceptedAt) {
    // Already accepted
    redirect(`/dashboard?invite=already-accepted`);
  }

  // Check email matches
  if (member.email !== session.user.email?.toLowerCase()) {
    redirect("/dashboard?invite=wrong-email");
  }

  // Accept the invite
  await db
    .update(teamMembers)
    .set({
      userId: session.user.id,
      inviteAcceptedAt: new Date(),
      inviteToken: null, // invalidate token
      updatedAt: new Date(),
    })
    .where(eq(teamMembers.id, member.id));

  redirect(`/dashboard?invite=accepted&project=${member.projectId}`);
}
