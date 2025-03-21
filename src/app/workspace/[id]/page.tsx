import { Suspense } from 'react';
import { getWorkspace } from '@/lib/actions/workspace';
import { getWorkspaceMembers } from '@/lib/actions/workspace-members';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

function LoadingWorkspace() {
  return (
    <div className='flex h-48 w-full items-center justify-center'>
      <div className='flex flex-col items-center'>
        <Spinner size='lg' className='text-blue-500' />
        <p className='text-muted-foreground mt-4 text-sm'>
          Loading workspace...
        </p>
      </div>
    </div>
  );
}

function WorkspaceContent({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<LoadingWorkspace />}>
      <WorkspaceData params={params} />
    </Suspense>
  );
}

async function WorkspaceData({ params }: { params: { id: string } }) {
  const workspace = await getWorkspace(params.id);
  const members = await getWorkspaceMembers(params.id);

  return (
    <>
      <div className='mb-8 flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold'>{workspace.name}</h1>
          <p className='text-muted-foreground'>
            Your role: <span className='capitalize'>{workspace.role}</span>
          </p>
        </div>
        {workspace.role === 'admin' && (
          <div className='flex gap-2'>
            <Button asChild variant='outline'>
              <Link href={`/workspace/${params.id}/invites`}>
                Manage Invites
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/workspace/${params.id}/settings`}>
                Workspace Settings
              </Link>
            </Button>
          </div>
        )}
      </div>

      <div className='grid gap-6 md:grid-cols-2'>
        <div>
          <h2 className='mb-4 text-xl font-semibold'>Team Members</h2>
          <div className='rounded-lg border'>
            <div className='p-4'>
              <p className='text-muted-foreground text-sm'>
                {members.length} member{members.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className='divide-y'>
              {members.map((member) => (
                <div
                  key={member.userId}
                  className='flex items-center justify-between p-4'
                >
                  <div>
                    <p className='font-medium'>
                      {member.name || 'Unnamed User'}
                    </p>
                    <p className='text-muted-foreground text-sm'>
                      {member.email}
                    </p>
                    <p className='text-muted-foreground text-sm capitalize'>
                      {member.role}
                    </p>
                  </div>
                  {workspace.role === 'admin' && (
                    <Button asChild size='sm' variant='ghost'>
                      <Link
                        href={`/workspace/${params.id}/members/${member.userId}`}
                      >
                        Manage
                      </Link>
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {workspace.role === 'admin' && (
              <div className='border-t p-4'>
                <Button asChild variant='outline' className='w-full'>
                  <Link href={`/workspace/${params.id}/invite`}>
                    Invite People
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 className='mb-4 text-xl font-semibold'>Workspace Activity</h2>
          <div className='rounded-lg border p-6 text-center'>
            <p className='text-muted-foreground'>
              Workspace activity will be shown here
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default async function WorkspacePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/');
  }

  try {
    return (
      <div className='container mx-auto p-6'>
        <WorkspaceContent params={params} />
      </div>
    );
  } catch (error) {
    // If workspace not found or user doesn't have access
    redirect('/workspace/create');
  }
}
