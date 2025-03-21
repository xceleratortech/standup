'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  meeting,
  meetingRecording,
  workspaceUser,
  meetingParticipant,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import {
  s3Client,
  S3_BUCKET,
  generateUploadUrl,
  generateDownloadUrl,
  generateFileKey,
} from '@/lib/s3';

// Get a signed URL for uploading a recording
export async function getRecordingUploadUrl({
  meetingId,
  fileName,
  contentType,
}: {
  meetingId: string;
  fileName: string;
  contentType: string;
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

  // Check if user can upload (admin, creator, or has organizer/editor role)
  const participant = await db.query.meetingParticipant.findFirst({
    where: and(
      eq(meetingParticipant.meetingId, meetingId),
      eq(meetingParticipant.userId, userId)
    ),
  });

  const canUpload =
    userWorkspace.role === 'admin' ||
    meetingData.createdById === userId ||
    participant?.role === 'organizer' ||
    participant?.role === 'editor';

  if (!canUpload) {
    throw new Error("You don't have permission to upload recordings");
  }

  // Generate a unique file key
  const fileKey = generateFileKey(meetingData.workspaceId, meetingId, fileName);

  // Generate a signed upload URL
  const uploadUrl = await generateUploadUrl(fileKey, contentType);

  return { uploadUrl, fileKey };
}

// Add a new recording to a meeting
export async function addMeetingRecording({
  meetingId,
  fileKey,
  recordingName,
  duration,
}: {
  meetingId: string;
  fileKey: string;
  recordingName?: string;
  duration?: string;
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

  // Check if user has permission to update this meeting
  const userWorkspace = await db.query.workspaceUser.findFirst({
    where: and(
      eq(workspaceUser.workspaceId, meetingData.workspaceId),
      eq(workspaceUser.userId, userId)
    ),
  });

  if (!userWorkspace) {
    throw new Error("You don't have access to this meeting");
  }

  const participant = await db.query.meetingParticipant.findFirst({
    where: and(
      eq(meetingParticipant.meetingId, meetingId),
      eq(meetingParticipant.userId, userId)
    ),
  });

  const canUpdate =
    userWorkspace.role === 'admin' ||
    meetingData.createdById === userId ||
    participant?.role === 'organizer' ||
    participant?.role === 'editor';

  if (!canUpdate) {
    throw new Error("You don't have permission to update this meeting");
  }

  // Generate a download URL
  const recordingUrl = await generateDownloadUrl(fileKey, 3600 * 24 * 7); // 1 week expiry

  // Create new recording entry
  const [newRecording] = await db
    .insert(meetingRecording)
    .values({
      meetingId,
      fileKey,
      recordingUrl,
      recordingName:
        recordingName || `Recording ${new Date().toLocaleString()}`,
      duration,
      createdById: userId,
    })
    .returning();

  // Update the meeting's updatedAt timestamp
  await db
    .update(meeting)
    .set({
      updatedAt: new Date(),
    })
    .where(eq(meeting.id, meetingId));

  revalidatePath(`/workspace/${meetingData.workspaceId}/meeting/${meetingId}`);
  return newRecording;
}

// Get all recordings for a meeting
export async function getMeetingRecordings(meetingId: string) {
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

  // Get all recordings for this meeting
  const recordings = await db
    .select()
    .from(meetingRecording)
    .where(eq(meetingRecording.meetingId, meetingId))
    .orderBy(meetingRecording.createdAt);

  return recordings;
}

// Get a fresh download URL for a recording
export async function getRecordingDownloadUrl(recordingId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

  // Get the recording
  const recordingData = await db.query.meetingRecording.findFirst({
    where: eq(meetingRecording.id, recordingId),
  });

  if (!recordingData) {
    throw new Error('Recording not found');
  }

  // Get the meeting
  const meetingData = await db.query.meeting.findFirst({
    where: eq(meeting.id, recordingData.meetingId),
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
    throw new Error("You don't have access to this recording");
  }

  // Generate a fresh download URL
  const downloadUrl = await generateDownloadUrl(recordingData.fileKey);

  return { downloadUrl };
}

// Delete a recording from S3 and the database
export async function deleteRecording(recordingId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

  // Get the recording
  const recordingData = await db.query.meetingRecording.findFirst({
    where: eq(meetingRecording.id, recordingId),
  });

  if (!recordingData) {
    throw new Error('Recording not found');
  }

  // Get the meeting
  const meetingData = await db.query.meeting.findFirst({
    where: eq(meeting.id, recordingData.meetingId),
  });

  if (!meetingData) {
    throw new Error('Meeting not found');
  }

  // Check if user is admin or the meeting creator
  const userWorkspace = await db.query.workspaceUser.findFirst({
    where: and(
      eq(workspaceUser.workspaceId, meetingData.workspaceId),
      eq(workspaceUser.userId, userId)
    ),
  });

  if (
    !userWorkspace ||
    (userWorkspace.role !== 'admin' &&
      meetingData.createdById !== userId &&
      recordingData.createdById !== userId)
  ) {
    throw new Error("You don't have permission to delete this recording");
  }

  try {
    // Delete the file from S3
    const deleteCommand = new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: recordingData.fileKey,
    });

    await s3Client.send(deleteCommand);

    // Delete the recording record
    await db
      .delete(meetingRecording)
      .where(eq(meetingRecording.id, recordingId));

    revalidatePath(
      `/workspace/${meetingData.workspaceId}/meeting/${recordingData.meetingId}`
    );
    return { success: true };
  } catch (error) {
    console.error('Error deleting recording:', error);
    throw new Error('Failed to delete recording');
  }
}
