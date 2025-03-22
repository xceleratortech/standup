import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { Authenticate } from '@/components/auth';
import AcceptInviteButton from './accept-button';
import Link from 'next/link';

export default async function InvitePage(props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // If user is not logged in, show login form
  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">Sign in to accept invitation</h1>
          <p className="text-muted-foreground">
            You need to sign in or create an account to join this workspace
          </p>
        </div>
        <div className="w-full max-w-md">
          <Authenticate />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg border p-6 text-center">
        <h1 className="mb-2 text-2xl font-bold">Workspace Invitation</h1>
        <p className="text-muted-foreground mb-6">You've been invited to join a workspace</p>

        <AcceptInviteButton token={params.token} />

        <div className="mt-4">
          <Link
            href="/"
            className="ring-offset-background focus-visible:ring-ring text-foreground hover:bg-accent hover:text-accent-foreground inline-flex h-10 items-center justify-center rounded-md bg-transparent px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
          >
            Decline
          </Link>
        </div>
      </div>
    </div>
  );
}
