import { Suspense } from 'react';
import { getWorkspaceInvites } from '@/lib/actions/workspace-members';
import { getWorkspace } from '@/lib/actions/workspace';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { Spinner } from '@/components/ui/spinner';
import DeleteInviteButton from './delete-button';
import WorkspaceNav from '@/components/workspace-nav';
import CopyLinkButton from './copy-button';
import { Link } from '@/components/ui/link';
import { Button } from '@/components/ui/button';

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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Pending Invites</h1>
          <p className="text-muted-foreground text-sm">{workspace.data?.name}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link prefetch href={`/workspace/${params.id}`}>
              Back to Workspace
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link prefetch href={`/workspace/${params.id}/invite`}>
              New Invite
            </Link>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border">
        {invites.data && invites.data.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-muted-foreground mb-4">No pending invites</p>
            <Button asChild size="sm">
              <Link href={`/workspace/${params.id}/invite`}>New Invite</Link>
            </Button>
          </div>
        ) : (
          <div className="divide-y">
            {invites.data?.map((invite) => (
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
                  <CopyLinkButton inviteUrl={invite.inviteUrl} />
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
    if (workspace.data?.role !== 'admin') {
      redirect(`/workspace/${params.id}`);
    }

    const breadcrumbs = [
      { label: workspace.data?.name || 'Workspace', href: `/workspace/${params.id}` },
      { label: 'Invites', href: `/workspace/${params.id}/invites`, current: true },
    ];

    return (
      <div className="container mx-auto space-y-2 p-6">
        <WorkspaceNav workspaceId={params.id} breadcrumbs={breadcrumbs} />
        <InvitesContent params={params} />
      </div>
    );
  } catch (error) {
    redirect(`/workspace/${params.id}`);
  }
}
