import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { Spinner } from '@/components/ui/spinner';
import WorkspaceNav from '@/components/workspace-nav';

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
  return <div>Workspace Details</div>;
}

export default async function WorkspacePage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/');
  }

  try {
    return (
      <div className='container mx-auto p-4'>
        <WorkspaceNav workspaceId={params.id} />
        <WorkspaceContent params={params} />
      </div>
    );
  } catch (error) {
    // If workspace not found or user doesn't have access
    redirect('/workspace/create');
  }
}
