'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { meeting, meetingParticipant, workspaceUser, MEETING_ROLES } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { user } from '@/lib/db/auth-schema';

// Add a participant to a meeting
export async function addMeetingParticipant({
  meetingId,
  userId,
  role = MEETING_ROLES.VIEWER,
}: {
  meetingId: string;
  userId: string;
  role?: string;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error('Unauthorized');
  }

  const currentUserId = session.user.id;

  // Get the meeting
  const meetingData = await db.query.meeting.findFirst({
    where: eq(meeting.id, meetingId),
  });

  if (!meetingData) {
    throw new Error('Meeting not found');
  }

  // Check if current user has admin rights in this workspace or is the meeting creator
  const userWorkspace = await db.query.workspaceUser.findFirst({
    where: and(
      eq(workspaceUser.workspaceId, meetingData.workspaceId),
      eq(workspaceUser.userId, currentUserId)
    ),
  });

  if (
    !userWorkspace ||
    (userWorkspace.role !== 'admin' && meetingData.createdById !== currentUserId)
  ) {
    throw new Error("You don't have permission to add participants");
  }

  // Check if the user to add is a member of the workspace
  const memberWorkspace = await db.query.workspaceUser.findFirst({
    where: and(
      eq(workspaceUser.workspaceId, meetingData.workspaceId),
      eq(workspaceUser.userId, userId)
    ),
  });

  if (!memberWorkspace) {
    throw new Error('User is not a member of this workspace');
  }

  // Check if user is already a participant
  const existingParticipant = await db.query.meetingParticipant.findFirst({
    where: and(eq(meetingParticipant.meetingId, meetingId), eq(meetingParticipant.userId, userId)),
  });

  if (existingParticipant) {
    throw new Error('User is already a participant in this meeting');
  }

  // Add the participant
  await db.insert(meetingParticipant).values({
    meetingId,
    userId,
    role,
  });

  revalidatePath(`/workspaces/${meetingData.workspaceId}/meetings/${meetingId}`);
  return { success: true };
}

// Get all participants of a meeting
export async function getMeetingParticipants(meetingId: string) {
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

  // Get all participants with user details
  const participants = await db
    .select({
      userId: meetingParticipant.userId,
      role: meetingParticipant.role,
      name: user.name,
      email: user.email,
      image: user.image,
    })
    .from(meetingParticipant)
    .innerJoin(user, eq(meetingParticipant.userId, user.id))
    .where(eq(meetingParticipant.meetingId, meetingId));

  return participants;
}

// Update a participant's role
export async function updateParticipantRole({
  meetingId,
  userId,
  newRole,
}: {
  meetingId: string;
  userId: string;
  newRole: string;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error('Unauthorized');
  }

  const currentUserId = session.user.id;

  // Get the meeting
  const meetingData = await db.query.meeting.findFirst({
    where: eq(meeting.id, meetingId),
  });

  if (!meetingData) {
    throw new Error('Meeting not found');
  }

  // Check if current user has admin rights or is the meeting creator
  const userWorkspace = await db.query.workspaceUser.findFirst({
    where: and(
      eq(workspaceUser.workspaceId, meetingData.workspaceId),
      eq(workspaceUser.userId, currentUserId)
    ),
  });

  if (
    !userWorkspace ||
    (userWorkspace.role !== 'admin' && meetingData.createdById !== currentUserId)
  ) {
    throw new Error("You don't have permission to update roles");
  }

  // Update the participant's role
  await db
    .update(meetingParticipant)
    .set({
      role: newRole,
      updatedAt: new Date(),
    })
    .where(and(eq(meetingParticipant.meetingId, meetingId), eq(meetingParticipant.userId, userId)));

  revalidatePath(`/workspaces/${meetingData.workspaceId}/meetings/${meetingId}`);
  return { success: true };
}

// Remove a participant from a meeting
export async function removeParticipant({
  meetingId,
  userId,
}: {
  meetingId: string;
  userId: string;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error('Unauthorized');
  }

  const currentUserId = session.user.id;

  // Get the meeting
  const meetingData = await db.query.meeting.findFirst({
    where: eq(meeting.id, meetingId),
  });

  if (!meetingData) {
    throw new Error('Meeting not found');
  }

  // Check if current user is admin, meeting creator, or the participant being removed
  const userWorkspace = await db.query.workspaceUser.findFirst({
    where: and(
      eq(workspaceUser.workspaceId, meetingData.workspaceId),
      eq(workspaceUser.userId, currentUserId)
    ),
  });

  const isAdminOrCreator =
    userWorkspace?.role === 'admin' || meetingData.createdById === currentUserId;

  if (!userWorkspace || (!isAdminOrCreator && currentUserId !== userId)) {
    throw new Error("You don't have permission to remove participants");
  }

  // Remove the participant
  await db
    .delete(meetingParticipant)
    .where(and(eq(meetingParticipant.meetingId, meetingId), eq(meetingParticipant.userId, userId)));

  revalidatePath(`/workspaces/${meetingData.workspaceId}/meetings/${meetingId}`);
  return { success: true };
}
