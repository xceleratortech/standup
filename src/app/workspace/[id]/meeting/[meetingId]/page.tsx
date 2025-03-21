import { Suspense } from 'react';
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
import { Button } from '@/components/ui/button';
import { Calendar, Clock, ChevronLeft, Edit } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { RecordingList } from '@/components/meetings/recording-list';
import MeetingTranscription from '@/components/meetings/meeting-transcription';
import MeetingOutcomes from '@/components/meetings/meeting-outcomes';
import MeetingParticipants from '@/components/meetings/meeting-participants';

function LoadingMeeting() {
  return (
    <div className='flex h-48 w-full items-center justify-center'>
      <div className='flex flex-col items-center'>
        <Spinner size='lg' className='text-blue-500' />
        <p className='text-muted-foreground mt-4 text-sm'>Loading meeting...</p>
      </div>
    </div>
  );
}

function MeetingContent({
  params,
}: {
  params: { id: string; meetingId: string };
}) {
  return (
    <Suspense fallback={<LoadingMeeting />}>
      <MeetingData params={params} />
    </Suspense>
  );
}

async function MeetingData({
  params,
}: {
  params: { id: string; meetingId: string };
}) {
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
    where: and(
      eq(workspaceUser.workspaceId, params.id),
      eq(workspaceUser.userId, userId!)
    ),
  });

  const isAdmin = userWorkspace?.role === 'admin';
  const isCreator = meeting.createdById === userId;
  const canEdit = isAdmin || isCreator;

  // Format dates for display
  const startTimeFormatted = meeting.startTime
    ? format(new Date(meeting.startTime), 'PPP p')
    : 'Not set';

  const durationFormatted =
    meeting.startTime && meeting.endTime
      ? `${Math.round((new Date(meeting.endTime).getTime() - new Date(meeting.startTime).getTime()) / 60000)} minutes`
      : 'Unknown duration';

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div className='space-y-1'>
          <div className='flex items-center gap-2'>
            <Link
              href={`/workspace/${params.id}`}
              className='text-muted-foreground hover:text-foreground flex items-center text-sm'
            >
              <ChevronLeft className='mr-1 h-4 w-4' />
              Back to Meetings
            </Link>
          </div>
          <h1 className='text-3xl font-bold tracking-tight'>{meeting.title}</h1>
          <p className='text-muted-foreground'>
            Created{' '}
            {formatDistanceToNow(new Date(meeting.createdAt), {
              addSuffix: true,
            })}
          </p>
        </div>

        {canEdit && (
          <Button size='sm' className='gap-2'>
            <Edit className='h-4 w-4' />
            Edit Meeting
          </Button>
        )}
      </div>

      <Separator />

      <div className='grid grid-cols-1 gap-6 md:grid-cols-3'>
        <div className='space-y-6 md:col-span-2'>
          {meeting.description && (
            <div className='space-y-2'>
              <h2 className='text-xl font-semibold'>Description</h2>
              <p className='text-muted-foreground'>{meeting.description}</p>
            </div>
          )}

          <RecordingList meetingId={params.meetingId} canEdit={canEdit} />

          {meeting.transcription && (
            <MeetingTranscription transcription={meeting.transcription} />
          )}

          <MeetingOutcomes
            meetingId={params.meetingId}
            canEdit={canEdit}
            initialOutcomes={outcomes}
          />
        </div>

        <div className='space-y-6'>
          <div className='space-y-4 rounded-lg border p-4'>
            <h3 className='font-medium'>Meeting Details</h3>
            <div className='space-y-3'>
              <div className='flex items-center gap-2'>
                <Calendar className='text-muted-foreground h-4 w-4' />
                <span className='text-sm'>{startTimeFormatted}</span>
              </div>
              {meeting.startTime && meeting.endTime && (
                <div className='flex items-center gap-2'>
                  <Clock className='text-muted-foreground h-4 w-4' />
                  <span className='text-sm'>{durationFormatted}</span>
                </div>
              )}
            </div>
          </div>

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

    return (
      <div className='container mx-auto p-4 pb-24'>
        <WorkspaceNav workspaceId={params.id} />
        <MeetingContent params={params} />
      </div>
    );
  } catch (error) {
    // If workspace not found or user doesn't have access
    redirect('/workspace/create');
  }
}
