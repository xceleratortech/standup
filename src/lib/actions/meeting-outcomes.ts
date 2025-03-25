'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  meeting,
  meetingOutcome,
  meetingParticipant,
  workspaceUser,
  meetingRecording,
} from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { generateOutcome } from './ai/generate';
import { user } from '../db/auth-schema';

// Create a meeting outcome
export async function createMeetingOutcome({
  meetingId,
  type,
  content,
  meta,
}: {
  meetingId: string;
  type: string;
  content: string;
  meta?: string;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

  // Get the meeting
  const meetingData = await db.query.meeting.findFirst({
    where: eq(meeting.id, meetingId),
  });

  if (!meetingData) {
    throw new Error('Meeting not found');
  }

  // Check if user has access to this workspace
  const userWorkspace = await db.query.workspaceUser.findFirst({
    where: and(
      eq(workspaceUser.workspaceId, meetingData.workspaceId),
      eq(workspaceUser.userId, userId)
    ),
  });

  if (!userWorkspace) {
    throw new Error("You don't have access to this meeting");
  }

  // Check if user can edit this meeting (admin, creator, or editor role)
  const participant = await db.query.meetingParticipant.findFirst({
    where: and(eq(meetingParticipant.meetingId, meetingId), eq(meetingParticipant.userId, userId)),
  });

  const canEdit =
    userWorkspace.role === 'admin' ||
    meetingData.createdById === userId ||
    participant?.role === 'organizer' ||
    participant?.role === 'editor';

  if (!canEdit) {
    throw new Error("You don't have permission to create outcomes for this meeting");
  }

  // Create the outcome
  const [outcome] = await db
    .insert(meetingOutcome)
    .values({
      meetingId,
      type,
      content,
      meta,
      createdById: userId,
    })
    .returning();

  revalidatePath(`/workspace/${meetingData.workspaceId}/meeting/${meetingId}`);
  return outcome;
}

// Get all outcomes for a meeting
export async function getMeetingOutcomes(meetingId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

  // Get the meeting
  const meetingData = await db.query.meeting.findFirst({
    where: eq(meeting.id, meetingId),
  });

  if (!meetingData) {
    throw new Error('Meeting not found');
  }

  // Check if user has access to this workspace
  const userWorkspace = await db.query.workspaceUser.findFirst({
    where: and(
      eq(workspaceUser.workspaceId, meetingData.workspaceId),
      eq(workspaceUser.userId, userId)
    ),
  });

  if (!userWorkspace) {
    throw new Error("You don't have access to this meeting");
  }

  // Get all outcomes
  const outcomes = await db
    .select()
    .from(meetingOutcome)
    .where(eq(meetingOutcome.meetingId, meetingId));

  return outcomes;
}

// Update a meeting outcome
export async function updateMeetingOutcome({
  outcomeId,
  type,
  content,
  meta,
}: {
  outcomeId: string;
  type?: string;
  content?: string;
  meta?: string;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

  // Get the outcome
  const outcomeData = await db.query.meetingOutcome.findFirst({
    where: eq(meetingOutcome.id, outcomeId),
  });

  if (!outcomeData) {
    throw new Error('Outcome not found');
  }

  // Get the meeting
  const meetingData = await db.query.meeting.findFirst({
    where: eq(meeting.id, outcomeData.meetingId),
  });

  if (!meetingData) {
    throw new Error('Meeting not found');
  }

  // Check if user has access to this workspace
  const userWorkspace = await db.query.workspaceUser.findFirst({
    where: and(
      eq(workspaceUser.workspaceId, meetingData.workspaceId),
      eq(workspaceUser.userId, userId)
    ),
  });

  if (!userWorkspace) {
    throw new Error("You don't have access to this meeting");
  }

  // Check if user can edit this outcome (admin, creator, or the person who created it)
  const participant = await db.query.meetingParticipant.findFirst({
    where: and(
      eq(meetingParticipant.meetingId, outcomeData.meetingId),
      eq(meetingParticipant.userId, userId)
    ),
  });

  const canEdit =
    userWorkspace.role === 'admin' ||
    meetingData.createdById === userId ||
    outcomeData.createdById === userId ||
    participant?.role === 'organizer' ||
    participant?.role === 'editor';

  if (!canEdit) {
    throw new Error("You don't have permission to update this outcome");
  }

  // Update the outcome
  const [updatedOutcome] = await db
    .update(meetingOutcome)
    .set({
      type: type !== undefined ? type : outcomeData.type,
      content: content !== undefined ? content : outcomeData.content,
      meta: meta !== undefined ? meta : outcomeData.meta,
      updatedAt: new Date(),
    })
    .where(eq(meetingOutcome.id, outcomeId))
    .returning();

  revalidatePath(`/workspace/${meetingData.workspaceId}/meeting/${outcomeData.meetingId}`);
  return updatedOutcome;
}

// Delete a meeting outcome
export async function deleteMeetingOutcome(outcomeId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

  // Get the outcome
  const outcomeData = await db.query.meetingOutcome.findFirst({
    where: eq(meetingOutcome.id, outcomeId),
  });

  if (!outcomeData) {
    throw new Error('Outcome not found');
  }

  // Get the meeting
  const meetingData = await db.query.meeting.findFirst({
    where: eq(meeting.id, outcomeData.meetingId),
  });

  if (!meetingData) {
    throw new Error('Meeting not found');
  }

  // Check if user has admin rights or created the outcome
  const userWorkspace = await db.query.workspaceUser.findFirst({
    where: and(
      eq(workspaceUser.workspaceId, meetingData.workspaceId),
      eq(workspaceUser.userId, userId)
    ),
  });

  const participant = await db.query.meetingParticipant.findFirst({
    where: and(
      eq(meetingParticipant.meetingId, outcomeData.meetingId),
      eq(meetingParticipant.userId, userId)
    ),
  });

  const canDelete =
    userWorkspace?.role === 'admin' ||
    meetingData.createdById === userId ||
    outcomeData.createdById === userId ||
    participant?.role === 'organizer';

  if (!userWorkspace || !canDelete) {
    throw new Error("You don't have permission to delete this outcome");
  }

  // Delete the outcome
  await db.delete(meetingOutcome).where(eq(meetingOutcome.id, outcomeId));

  revalidatePath(`/workspace/${meetingData.workspaceId}/meeting/${outcomeData.meetingId}`);
  return { success: true };
}

// Generate an outcome from meeting recordings with transcriptions
export async function generateMeetingOutcome({
  meetingId,
  outcomeType,
  additionalPrompt,
  focusParticipantId,
}: {
  meetingId: string;
  outcomeType: 'summary' | 'actions';
  additionalPrompt?: string;
  focusParticipantId?: string;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

  // Get the meeting
  const meetingData = await db.query.meeting.findFirst({
    where: eq(meeting.id, meetingId),
  });

  if (!meetingData) {
    throw new Error('Meeting not found');
  }

  // Check if user has access to this workspace
  const userWorkspace = await db.query.workspaceUser.findFirst({
    where: and(
      eq(workspaceUser.workspaceId, meetingData.workspaceId),
      eq(workspaceUser.userId, userId)
    ),
  });

  if (!userWorkspace) {
    throw new Error("You don't have access to this meeting");
  }

  // Check if user can edit this meeting (admin, creator, or editor role)
  const participant = await db.query.meetingParticipant.findFirst({
    where: and(eq(meetingParticipant.meetingId, meetingId), eq(meetingParticipant.userId, userId)),
  });

  const canEdit =
    userWorkspace.role === 'admin' ||
    meetingData.createdById === userId ||
    participant?.role === 'organizer' ||
    participant?.role === 'editor';

  if (!canEdit) {
    throw new Error("You don't have permission to create outcomes for this meeting");
  }

  // Get all recordings with transcriptions for this meeting
  const recordings = await db
    .select()
    .from(meetingRecording)
    .where(
      and(eq(meetingRecording.meetingId, meetingId), isNotNull(meetingRecording.transcription))
    );

  if (recordings.length === 0) {
    throw new Error('No transcriptions found for this meeting');
  }

  // Extract transcriptions
  const transcripts = recordings.map((recording) => recording.transcription as string);

  // Get focus participant details if provided
  let focusParticipantInfo = null;
  if (focusParticipantId) {
    const participant = await db
      .select({
        id: meetingParticipant.userId,
        name: user.name,
        email: user.email,
      })
      .from(meetingParticipant)
      .innerJoin(user, eq(meetingParticipant.userId, user.id))
      .where(
        and(
          eq(meetingParticipant.meetingId, meetingId),
          eq(meetingParticipant.userId, focusParticipantId)
        )
      )
      .limit(1);

    if (participant.length > 0) {
      focusParticipantInfo = participant[0];
    }
  }

  // Generate content using AI
  const content = await generateOutcome(
    transcripts,
    outcomeType,
    additionalPrompt,
    focusParticipantInfo
  );

  // Create the outcome
  const [outcome] = await db
    .insert(meetingOutcome)
    .values({
      meetingId,
      type: outcomeType === 'summary' ? 'Summary' : 'Action Items',
      content,
      createdById: userId,
      meta: focusParticipantId ? JSON.stringify({ focusParticipantId }) : null,
    })
    .returning();

  revalidatePath(`/workspace/${meetingData.workspaceId}/meeting/${meetingId}`);
  return outcome;
}
