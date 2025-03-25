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
import { user } from '../db/auth-schema';

// Create a new meeting
export async function createMeeting({
  workspaceId,
  title,
  description,
  startTime,
  endTime,
  participantIds,
}: {
  workspaceId: string;
  title: string;
  description?: string;
  startTime?: Date;
  endTime?: Date;
  participantIds?: string[];
}) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { error: 'Unauthorized' };
    }

    const userId = session.user.id;

    // Check if user has access to this workspace
    const userWorkspace = await db.query.workspaceUser.findFirst({
      where: and(eq(workspaceUser.workspaceId, workspaceId), eq(workspaceUser.userId, userId)),
    });

    if (!userWorkspace) {
      return { error: "Workspace not found or you don't have access" };
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

    // Add participants if provided
    if (participantIds && participantIds.length > 0) {
      // First validate that all participants are members of the workspace
      const workspaceMembers = await db.query.workspaceUser.findMany({
        where: eq(workspaceUser.workspaceId, workspaceId),
      });

      const validMemberIds = workspaceMembers.map((member) => member.userId);

      // Filter out any invalid participant IDs
      const validParticipantIds = participantIds.filter((id) => validMemberIds.includes(id));

      // Add each participant
      if (validParticipantIds.length > 0) {
        await db.insert(meetingParticipant).values(
          validParticipantIds.map((participantId) => ({
            meetingId: newMeeting.id,
            userId: participantId,
          }))
        );
      }
    } else {
      // If no participants specified, add the creator as a participant
      await db.insert(meetingParticipant).values({
        meetingId: newMeeting.id,
        userId: userId,
      });
    }

    revalidatePath(`/workspace/${workspaceId}`);
    return { data: newMeeting };
  } catch (error) {
    console.error('Error creating meeting:', error);
    return { error: 'Failed to create meeting' };
  }
}

// Get a meeting by ID
export async function getMeeting(meetingId: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { error: 'Unauthorized' };
    }

    const userId = session.user.id;

    // Get the meeting
    const meetingData = await db.query.meeting.findFirst({
      where: eq(meeting.id, meetingId),
    });

    if (!meetingData) {
      return { error: 'Meeting not found' };
    }

    // Check if user has access to this workspace
    const userWorkspace = await db.query.workspaceUser.findFirst({
      where: and(
        eq(workspaceUser.workspaceId, meetingData.workspaceId),
        eq(workspaceUser.userId, userId)
      ),
    });

    if (!userWorkspace) {
      return { error: "You don't have access to this meeting" };
    }

    return { data: meetingData };
  } catch (error) {
    console.error('Error getting meeting:', error);
    return { error: 'Failed to get meeting' };
  }
}

// Get all meetings for a workspace
export async function getWorkspaceMeetings(workspaceId: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { error: 'Unauthorized' };
    }

    const userId = session.user.id;

    // Check if user has access to this workspace
    const userWorkspace = await db.query.workspaceUser.findFirst({
      where: and(eq(workspaceUser.workspaceId, workspaceId), eq(workspaceUser.userId, userId)),
    });

    if (!userWorkspace) {
      return { error: "Workspace not found or you don't have access" };
    }

    // Get all workspace meetings
    const meetings = await db
      .select()
      .from(meeting)
      .where(eq(meeting.workspaceId, workspaceId))
      .orderBy(desc(meeting.createdAt));

    return { data: meetings };
  } catch (error) {
    console.error('Error getting workspace meetings:', error);
    return { error: 'Failed to get workspace meetings' };
  }
}

// Get all members of a workspace
export async function getWorkspaceMembers(workspaceId: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { error: 'Unauthorized' };
    }

    const userId = session.user.id;

    // Check if user has access to this workspace
    const userWorkspace = await db.query.workspaceUser.findFirst({
      where: and(eq(workspaceUser.workspaceId, workspaceId), eq(workspaceUser.userId, userId)),
    });

    if (!userWorkspace) {
      return { error: "Workspace not found or you don't have access" };
    }

    // Get all workspace members with user details using join
    const workspaceMembers = await db
      .select({
        workspaceId: workspaceUser.workspaceId,
        userId: workspaceUser.userId,
        role: workspaceUser.role,
        joinedAt: workspaceUser.createdAt,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        },
      })
      .from(workspaceUser)
      .innerJoin(user, eq(workspaceUser.userId, user.id))
      .where(eq(workspaceUser.workspaceId, workspaceId));

    // Add an isCurrentUser flag to identify the current user
    const formattedMembers = workspaceMembers.map((member) => ({
      ...member,
      isCurrentUser: member.userId === userId,
    }));

    return { data: formattedMembers };
  } catch (error) {
    console.error('Error getting workspace members:', error);
    return { error: 'Failed to get workspace members' };
  }
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
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { error: 'Unauthorized' };
    }

    const userId = session.user.id;

    // Use id or meetingId (for backward compatibility)
    const meetingIdToUse = id || meetingId;

    if (!meetingIdToUse) {
      return { error: 'Meeting ID is required' };
    }

    // Get the meeting
    const meetingData = await db.query.meeting.findFirst({
      where: eq(meeting.id, meetingIdToUse),
    });

    if (!meetingData) {
      return { error: 'Meeting not found' };
    }

    // Check if user has access to this workspace
    const userWorkspace = await db.query.workspaceUser.findFirst({
      where: and(
        eq(workspaceUser.workspaceId, meetingData.workspaceId),
        eq(workspaceUser.userId, userId)
      ),
    });

    if (!userWorkspace) {
      return { error: "You don't have access to this meeting" };
    }

    // Check if user can edit this meeting (admin or creator or editor)
    const canEdit = userWorkspace.role === 'admin' || meetingData.createdById === userId;

    if (!canEdit) {
      return { error: "You don't have permission to edit this meeting" };
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
    return { data: updatedMeeting };
  } catch (error) {
    console.error('Error updating meeting:', error);
    return { error: 'Failed to update meeting' };
  }
}

// Delete a meeting
export async function deleteMeeting(meetingId: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { error: 'Unauthorized' };
    }

    const userId = session.user.id;

    // Get the meeting
    const meetingData = await db.query.meeting.findFirst({
      where: eq(meeting.id, meetingId),
    });

    if (!meetingData) {
      return { error: 'Meeting not found' };
    }

    // Check if user is workspace admin or meeting creator
    const userWorkspace = await db.query.workspaceUser.findFirst({
      where: and(
        eq(workspaceUser.workspaceId, meetingData.workspaceId),
        eq(workspaceUser.userId, userId)
      ),
    });

    if (!userWorkspace || (userWorkspace.role !== 'admin' && meetingData.createdById !== userId)) {
      return { error: "You don't have permission to delete this meeting" };
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

      revalidatePath(`/workspace/${meetingData.workspaceId}`);
      return { data: { success: true } };
    } catch (error) {
      console.error('Error deleting meeting:', error);
      return { error: 'Failed to delete meeting' };
    }
  } catch (error) {
    console.error('Error deleting meeting:', error);
    return { error: 'Failed to delete meeting' };
  }
}
