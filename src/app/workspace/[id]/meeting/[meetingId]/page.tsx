import { Suspense } from 'react';

import { RecordingControls } from '@/components/meetings/recording-controls';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { Spinner } from '@/components/ui/spinner';
import { db } from '@/lib/db';
import { getMeeting } from '@/lib/actions/meeting';
import { getMeetingParticipants } from '@/lib/actions/meeting-participants';
import { getMeetingOutcomes } from '@/lib/actions/meeting-outcomes';
import { workspace, workspaceUser } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import WorkspaceNav from '@/components/workspace-nav';
import { Calendar, Clock, Edit } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { RecordingList } from '@/components/meetings/recording-list';
import MeetingOutcomes from '@/components/meetings/meeting-outcomes';
import MeetingParticipants from '@/components/meetings/meeting-participants';
import { EditMeetingDialog } from '@/components/meetings/edit-meeting-dialog';

function LoadingMeeting() {
  return (
    <div className="flex h-48 w-full items-center justify-center">
      <div className="flex flex-col items-center">
        <Spinner size="lg" className="text-blue-500" />
        <p className="text-muted-foreground mt-4 text-sm">Loading meeting...</p>
      </div>
    </div>
  );
}

function MeetingContent({ params }: { params: { id: string; meetingId: string } }) {
  return (
    <Suspense fallback={<LoadingMeeting />}>
      <MeetingData params={params} />
    </Suspense>
  );
}

async function MeetingData({ params }: { params: { id: string; meetingId: string } }) {
  const meeting = await getMeeting(params.meetingId);
  const participants = await getMeetingParticipants(params.meetingId);
  const outcomes = await getMeetingOutcomes(params.meetingId);

  // Get current session
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const userId = session?.user.id;

  // Check if user can edit this meeting
  const userWorkspace = await db.query.workspaceUser.findFirst({
    where: and(eq(workspaceUser.workspaceId, params.id), eq(workspaceUser.userId, userId!)),
  });

  const isAdmin = userWorkspace?.role === 'admin';
  const isCreator = meeting.createdById === userId;
  const canEdit = isAdmin || isCreator;

  // Format dates for display
  const startTimeFormatted = meeting.startTime
    ? format(new Date(meeting.startTime), 'PPP p')
    : 'Not scheduled';

  const durationFormatted =
    meeting.startTime && meeting.endTime
      ? `${Math.round((new Date(meeting.endTime).getTime() - new Date(meeting.startTime).getTime()) / 60000)} minutes`
      : 'Unknown duration';

  return (
    <div className="space-y-2">
      {/* Meeting Header */}
      <div className="px-3">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-medium tracking-tight">{meeting.title}</h1>
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">
              <Calendar className="h-4 w-4" />
              <span>{startTimeFormatted}</span>
              {meeting.startTime && meeting.endTime && (
                <>
                  <span className="px-1">•</span>
                  <Clock className="h-4 w-4" />
                  <span>{durationFormatted}</span>
                </>
              )}
              <span className="px-1">•</span>
              <span>
                Created{' '}
                {formatDistanceToNow(new Date(meeting.createdAt), {
                  addSuffix: true,
                })}
              </span>
            </div>
          </div>

          {canEdit && (
            <EditMeetingDialog
              meetingId={params.meetingId}
              initialTitle={meeting.title}
              initialDescription={meeting.description}
            />
          )}
        </div>

        {meeting.description && (
          <p className="text-muted-foreground mt-4 text-sm">{meeting.description}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 px-3 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {/* Recordings Section */}
          <RecordingList meetingId={params.meetingId} canEdit={canEdit} />

          {/* Outcomes Section */}
          <MeetingOutcomes
            meetingId={params.meetingId}
            canEdit={canEdit}
            initialOutcomes={outcomes}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Recording Controls */}
          <div className="overflow-hidden rounded-xl">
            <RecordingControls
              defaultSelectedMeetingId={params.meetingId}
              workspaceId={params.id}
            />
          </div>

          {/* Participants */}
          <MeetingParticipants
            meetingId={params.meetingId}
            workspaceId={params.id}
            canEdit={canEdit}
            initialParticipants={participants}
          />
        </div>
      </div>
    </div>
  );
}

export default async function MeetingPage(props: {
  params: Promise<{ id: string; meetingId: string }>;
}) {
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

    // Get meeting title for the breadcrumb
    const meeting = await getMeeting(params.meetingId);

    // Define breadcrumbs for navigation with actual meeting title
    const breadcrumbs = [
      {
        label: 'Meetings',
        href: `/workspace/${params.id}`,
      },
      {
        label: meeting.title,
        href: `/workspace/${params.id}/meeting/${params.meetingId}`,
        current: true,
      },
    ];

    return (
      <div className="container mx-auto pb-20">
        <div className="my-2">
          <WorkspaceNav workspaceId={params.id} breadcrumbs={breadcrumbs} />
        </div>
        <MeetingContent params={params} />
      </div>
    );
  } catch (error) {
    // If workspace not found or user doesn't have access
    redirect('/workspace/create');
  }
}
