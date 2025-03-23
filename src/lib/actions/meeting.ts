'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  meeting,
  workspaceUser,
  meetingRecording,
  meetingOutcome,
  meetingParticipant,
} from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { s3Client, S3_BUCKET } from '@/lib/s3';
import { DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

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
  id,
  meetingId,
  title,
  description,
  startTime,
  endTime,
}: {
  id?: string;
  meetingId?: string;
  title?: string;
  description?: string | null;
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

  // Use id or meetingId (for backward compatibility)
  const meetingIdToUse = id || meetingId;

  if (!meetingIdToUse) {
    throw new Error('Meeting ID is required');
  }

  // Get the meeting
  const meetingData = await db.query.meeting.findFirst({
    where: eq(meeting.id, meetingIdToUse),
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
      updatedAt: new Date(),
    })
    .where(eq(meeting.id, meetingIdToUse))
    .returning();

  revalidatePath(`/workspace/${meetingData.workspaceId}/meeting/${meetingIdToUse}`);
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

  try {
    // Get all recordings associated with this meeting
    const recordings = await db.query.meetingRecording.findMany({
      where: eq(meetingRecording.meetingId, meetingId),
    });

    // Delete all recordings files from S3
    if (recordings.length > 0) {
      // First, list all files in the meeting directory
      const prefix = `recordings/${meetingData.workspaceId}/${meetingId}/`;

      const listCommand = new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: prefix,
      });

      const { Contents } = await s3Client.send(listCommand);

      if (Contents && Contents.length > 0) {
        // Delete all objects found in the meeting directory
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: S3_BUCKET,
          Delete: {
            Objects: Contents.map((item) => ({ Key: item.Key! })),
            Quiet: false,
          },
        });

        await s3Client.send(deleteCommand);
      }
    }

    // Delete meeting and all associated data
    await db.transaction(async (tx) => {
      // Delete outcomes
      await tx.delete(meetingOutcome).where(eq(meetingOutcome.meetingId, meetingId));

      // Delete participants
      await tx.delete(meetingParticipant).where(eq(meetingParticipant.meetingId, meetingId));

      // Delete recordings from database
      await tx.delete(meetingRecording).where(eq(meetingRecording.meetingId, meetingId));

      // Delete the meeting itself
      await tx.delete(meeting).where(eq(meeting.id, meetingId));
    });

    revalidatePath('/workspace');
    return { success: true };
  } catch (error) {
    console.error('Error deleting meeting:', error);
    throw error;
  }
}
