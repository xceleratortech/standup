import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { Spinner } from '@/components/ui/spinner';
import WorkspaceNav from '@/components/workspace-nav';
import { getWorkspaceMeetings } from '@/lib/actions/meeting';
import MeetingsList from '@/components/meetings/meetings-list';
import { db } from '@/lib/db';
import { workspace, workspaceUser } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import WorkspaceRecordingControls from '@/components/meetings/workspace-recording-controls';

function LoadingWorkspace() {
  return (
    <div className="flex h-48 w-full items-center justify-center">
      <div className="flex flex-col items-center">
        <Spinner size="lg" className="text-blue-500" />
        <p className="text-muted-foreground mt-4 text-sm">Loading workspace...</p>
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
  const meetings = await getWorkspaceMeetings(params.id);

  return (
    <div className="space-y-8 py-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Meetings</h2>
      </div>

      <div className="relative min-h-[300px]">
        {meetings.length === 0 ? (
          <div className="flex h-[300px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
            <h3 className="text-lg font-semibold">No meetings yet</h3>
            <p className="text-muted-foreground mt-2">
              Start recording your first meeting using the recorder below.
            </p>
          </div>
        ) : (
          <MeetingsList meetings={meetings} workspaceId={params.id} />
        )}
      </div>
    </div>
  );
}

export default async function WorkspacePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/');
  }

  try {
    // Verify user has access to this workspace
    const userWorkspace = await db.query.workspaceUser.findFirst({
      where: and(
        eq(workspaceUser.workspaceId, params.id),
        eq(workspaceUser.userId, session.user.id)
      ),
    });

    if (!userWorkspace) {
      redirect('/workspace/create');
    }

    // Get workspace details
    const workspaceData = await db.query.workspace.findFirst({
      where: eq(workspace.id, params.id),
    });

    if (!workspaceData) {
      redirect('/workspace/create');
    }

    return (
      <div className="relative container mx-auto min-h-screen p-4 pb-16">
        <WorkspaceNav workspaceId={params.id} />
        <WorkspaceContent params={params} />
        <WorkspaceRecordingControls workspaceId={params.id} workspaceName={workspaceData.name} />
      </div>
    );
  } catch (error) {
    // If workspace not found or user doesn't have access
    redirect('/workspace/create');
  }
}
