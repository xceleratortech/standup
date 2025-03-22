'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { meeting, workspaceUser } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

// Create a new meeting
export async function createMeeting({
  workspaceId,
  title,
  description,
  startTime,
  endTime,
}: {
  workspaceId: string;
  title: string;
  description?: string;
  startTime?: Date;
  endTime?: Date;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

  // Check if user has access to this workspace
  const userWorkspace = await db.query.workspaceUser.findFirst({
    where: and(eq(workspaceUser.workspaceId, workspaceId), eq(workspaceUser.userId, userId)),
  });

  if (!userWorkspace) {
    throw new Error("Workspace not found or you don't have access");
  }

  // Create the meeting
  const [newMeeting] = await db
    .insert(meeting)
    .values({
      workspaceId,
      title,
      description,
      startTime: startTime || new Date(),
      endTime,
      createdById: userId,
    })
    .returning();

  revalidatePath(`/workspaces/${workspaceId}/meetings`);
  return newMeeting;
}

// Get a meeting by ID
export async function getMeeting(meetingId: string) {
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

  return meetingData;
}

// Get all meetings for a workspace
export async function getWorkspaceMeetings(workspaceId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

  // Check if user has access to this workspace
  const userWorkspace = await db.query.workspaceUser.findFirst({
    where: and(eq(workspaceUser.workspaceId, workspaceId), eq(workspaceUser.userId, userId)),
  });

  if (!userWorkspace) {
    throw new Error("Workspace not found or you don't have access");
  }

  // Get all workspace meetings
  const meetings = await db
    .select()
    .from(meeting)
    .where(eq(meeting.workspaceId, workspaceId))
    .orderBy(desc(meeting.createdAt));

  return meetings;
}

// Update a meeting
export async function updateMeeting({
  meetingId,
  title,
  description,
  startTime,
  endTime,
  transcription,
}: {
  meetingId: string;
  title?: string;
  description?: string;
  startTime?: Date;
  endTime?: Date;
  transcription?: string;
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

  // Check if user can edit this meeting (admin or creator or editor)
  const canEdit = userWorkspace.role === 'admin' || meetingData.createdById === userId;

  if (!canEdit) {
    throw new Error("You don't have permission to edit this meeting");
  }

  // Update the meeting
  const [updatedMeeting] = await db
    .update(meeting)
    .set({
      title: title !== undefined ? title : meetingData.title,
      description: description !== undefined ? description : meetingData.description,
      startTime: startTime || meetingData.startTime,
      endTime: endTime !== undefined ? endTime : meetingData.endTime,
      transcription: transcription !== undefined ? transcription : meetingData.transcription,
      updatedAt: new Date(),
    })
    .where(eq(meeting.id, meetingId))
    .returning();

  revalidatePath(`/workspaces/${meetingData.workspaceId}/meetings/${meetingId}`);
  return updatedMeeting;
}

// Delete a meeting
export async function deleteMeeting(meetingId: string) {
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

  // Check if user is workspace admin or meeting creator
  const userWorkspace = await db.query.workspaceUser.findFirst({
    where: and(
      eq(workspaceUser.workspaceId, meetingData.workspaceId),
      eq(workspaceUser.userId, userId)
    ),
  });

  if (!userWorkspace || (userWorkspace.role !== 'admin' && meetingData.createdById !== userId)) {
    throw new Error("You don't have permission to delete this meeting");
  }

  // Delete the meeting
  await db.delete(meeting).where(eq(meeting.id, meetingId));

  revalidatePath(`/workspaces/${meetingData.workspaceId}/meetings`);
  return { success: true };
}
