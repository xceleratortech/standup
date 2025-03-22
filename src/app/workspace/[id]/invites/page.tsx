import { Suspense } from 'react';
import { getWorkspaceInvites } from '@/lib/actions/workspace-members';
import { getWorkspace } from '@/lib/actions/workspace';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import DeleteInviteButton from './delete-button';

function LoadingInvites() {
  return (
    <div className="flex h-40 w-full items-center justify-center rounded-lg border">
      <div className="flex flex-col items-center">
        <Spinner size="md" className="text-blue-500" />
        <p className="text-muted-foreground mt-2 text-sm">Loading invites...</p>
      </div>
    </div>
  );
}

function InvitesContent({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<LoadingInvites />}>
      <InvitesData params={params} />
    </Suspense>
  );
}

async function InvitesData({ params }: { params: { id: string } }) {
  const workspace = await getWorkspace(params.id);
  const invites = await getWorkspaceInvites(params.id);

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pending Invites</h1>
          <p className="text-muted-foreground">{workspace.name}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/workspace/${params.id}`}>Back to Workspace</Link>
          </Button>
          <Button asChild>
            <Link href={`/workspace/${params.id}/invite`}>New Invite</Link>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border">
        {invites.length === 0 ? (
          <div className="text-muted-foreground p-6 text-center">No pending invites</div>
        ) : (
          <div className="divide-y">
            {invites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{invite.email || 'Invite Link'}</p>
                  <p className="text-muted-foreground text-sm">
                    Role: <span className="capitalize">{invite.role}</span>
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Expires: {new Date(invite.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(invite.inviteUrl);
                    }}
                  >
                    Copy Link
                  </Button>
                  <DeleteInviteButton inviteId={invite.id} workspaceId={params.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default async function WorkspaceInvitesPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/');
  }

  try {
    const workspace = await getWorkspace(params.id);

    // Only admins can view invites
    if (workspace.role !== 'admin') {
      redirect(`/workspace/${params.id}`);
    }

    return (
      <div className="container mx-auto p-6">
        <InvitesContent params={params} />
      </div>
    );
  } catch (error) {
    redirect(`/workspace/${params.id}`);
  }
}
