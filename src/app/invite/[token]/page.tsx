import { acceptWorkspaceInvite } from '@/lib/actions/workspace-members';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Authenticate } from '@/components/auth';
import AcceptInviteButton from './accept-button';

export default async function InvitePage({
  params,
}: {
  params: { token: string };
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // If user is not logged in, show login form
  if (!session) {
    return (
      <div className='flex min-h-screen flex-col items-center justify-center p-4'>
        <div className='mb-8 text-center'>
          <h1 className='text-2xl font-bold'>Sign in to accept invitation</h1>
          <p className='text-muted-foreground'>
            You need to sign in or create an account to join this workspace
          </p>
        </div>
        <div className='w-full max-w-md'>
          <Authenticate />
        </div>
      </div>
    );
  }

  return (
    <div className='flex min-h-screen flex-col items-center justify-center p-4'>
      <div className='w-full max-w-md rounded-lg border p-6 text-center'>
        <h1 className='mb-2 text-2xl font-bold'>Workspace Invitation</h1>
        <p className='text-muted-foreground mb-6'>
          You've been invited to join a workspace
        </p>

        <AcceptInviteButton token={params.token} />

        <div className='mt-4'>
          <Button variant='ghost' onClick={() => redirect('/')}>
            Decline
          </Button>
        </div>
      </div>
    </div>
  );
}
