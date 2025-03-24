'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  meeting,
  meetingRecording,
  workspaceUser,
  meetingParticipant,
  userVoiceIdentity,
} from '@/lib/db/schema';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import {
  s3Client,
  S3_BUCKET,
  generateUploadUrl,
  generateDownloadUrl,
  generateFileKey,
} from '@/lib/s3';
import { getTranscriptionFromAudioFile } from '@/lib/actions/ai/generate';
import { user } from '../db/auth-schema';

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
    where: and(eq(meetingParticipant.meetingId, meetingId), eq(meetingParticipant.userId, userId)),
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
  durationSeconds,
  addCurrentUserAsParticipant = false, // New parameter with default value
}: {
  meetingId: string;
  fileKey: string;
  recordingName?: string;
  duration?: string;
  durationSeconds?: string;
  addCurrentUserAsParticipant?: boolean; // Optional parameter
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
    where: and(eq(meetingParticipant.meetingId, meetingId), eq(meetingParticipant.userId, userId)),
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
      recordingName: recordingName || `Recording ${new Date().toLocaleString()}`,
      duration,
      durationSeconds, // Store the duration in seconds
      createdById: userId,
    })
    .returning();

  // If we should add the current user as a participant and they're not already
  if (addCurrentUserAsParticipant) {
    // Check if the user is already a participant
    const existingParticipant = await db.query.meetingParticipant.findFirst({
      where: and(
        eq(meetingParticipant.meetingId, meetingId),
        eq(meetingParticipant.userId, userId)
      ),
    });

    // If not already a participant, add them
    if (!existingParticipant) {
      await db.insert(meetingParticipant).values({
        meetingId,
        userId,
      });
    }
  }

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
    await db.delete(meetingRecording).where(eq(meetingRecording.id, recordingId));

    revalidatePath(`/workspace/${meetingData.workspaceId}/meeting/${recordingData.meetingId}`);
    return { success: true };
  } catch (error) {
    console.error('Error deleting recording:', error);
    throw new Error('Failed to delete recording');
  }
}

// Update a recording's transcription
export async function updateRecordingTranscription({
  recordingId,
  transcription,
}: {
  recordingId: string;
  transcription: string;
}) {
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

  // Check if user is admin or the meeting creator
  const canUpdate = userWorkspace.role === 'admin' || meetingData.createdById === userId;

  if (!canUpdate) {
    throw new Error("You don't have permission to update this recording");
  }

  // Update the transcription
  await db
    .update(meetingRecording)
    .set({ transcription })
    .where(eq(meetingRecording.id, recordingId));

  revalidatePath(`/workspace/${meetingData.workspaceId}/meeting/${recordingData.meetingId}`);
  return { success: true };
}

// Generate transcriptions for all recordings in a meeting that don't have them
export async function generateMissingTranscriptions(meetingId: string) {
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

  // Get all recordings for this meeting that don't have transcriptions
  const recordings = await db
    .select()
    .from(meetingRecording)
    .where(and(eq(meetingRecording.meetingId, meetingId), isNull(meetingRecording.transcription)));

  if (recordings.length === 0) {
    return { message: 'No recordings need transcription', updated: 0 };
  }

  // Get meeting participants with their user information
  const participants = await db
    .select({
      participant: meetingParticipant,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    })
    .from(meetingParticipant)
    .innerJoin(user, eq(meetingParticipant.userId, user.id))
    .where(eq(meetingParticipant.meetingId, meetingId));

  // Get all voice samples for all participants
  const participantIds = participants.map((p) => p.user.id);

  const voiceIdentities = await db
    .select()
    .from(userVoiceIdentity)
    .where(
      and(
        eq(userVoiceIdentity.workspaceId, meetingData.workspaceId),
        inArray(userVoiceIdentity.userId, participantIds)
      )
    );

  // Group voice samples by user ID
  const voiceSamplesByUser = voiceIdentities.reduce(
    (acc, sample) => {
      if (!acc[sample.userId]) {
        acc[sample.userId] = [];
      }
      acc[sample.userId].push(sample);
      return acc;
    },
    {} as Record<string, typeof voiceIdentities>
  );

  // Map participant info with their voice samples
  const participantsWithVoices = participants
    .map((p) => {
      const userSamples = voiceSamplesByUser[p.user.id] || [];
      return {
        userId: p.user.id,
        name: p.user.name,
        email: p.user.email,
        voiceSamples: userSamples.map((sample) => ({
          fileKey: sample.fileKey,
          sampleName: sample.sampleName || 'Voice Sample',
        })),
      };
    })
    .filter((p) => p.voiceSamples.length > 0);

  // Process each recording
  const results = [];
  for (const recording of recordings) {
    try {
      // Create an array of content items with alternating voice samples and prompts
      const contentItems = [];

      // Add intro prompt
      contentItems.push({
        type: 'prompt' as const,
        content: `I'll provide voice samples of meeting participants followed by the meeting recording that needs transcription. Please use these voice samples to accurately identify speakers in the meeting recording.`,
      });

      // Add voice samples with their identifying information
      if (participantsWithVoices.length > 0) {
        for (const participant of participantsWithVoices) {
          // Add each voice sample for this participant
          for (const sample of participant.voiceSamples) {
            // Add the voice sample file
            contentItems.push({
              type: 'audiofile' as const,
              content: sample.fileKey,
            });

            // Add prompt identifying this voice
            contentItems.push({
              type: 'prompt' as const,
              content: `The voice sample above (${sample.sampleName || 'Voice Sample'}) belongs to: ${participant.name} (${participant.email})`,
            });
          }
        }
      }

      // Add final instructions
      contentItems.push({
        type: 'prompt' as const,
        content: `
The above voice samples are from meeting participants, to help you identify them in the recording.

DO NOT INCLUDE THE VOICE SAMPLES ABOVE IN THE TRANSCRIPTION.

Generate a detailed transcription of the meeting recording below. 
Include voice inflections, timestamps, and speaker identification.
When you identify a speaker from the provided samples, use their email in the 'speaker' field.
If you can't identify who is speaking, use labels like "Person 1", "Person 2", etc. or even their name if they identify themself in the meeting, but always include a speaker field.
Format the output as a JSON schema.`,
      });
      // Add the main recording file
      contentItems.push({
        type: 'audiofile' as const,
        content: recording.fileKey,
      });

      // Generate transcription with the ordered content items
      const transcription = await getTranscriptionFromAudioFile(contentItems);
      console.log('Transcription:', transcription);
      // Update the recording with the transcription
      await db
        .update(meetingRecording)
        .set({
          transcription,
          updatedAt: new Date(),
        })
        .where(eq(meetingRecording.id, recording.id));

      results.push({
        recordingId: recording.id,
        status: 'success',
      });
    } catch (error: any) {
      console.error(`Error generating transcription for recording ${recording.id}:`, error);
      results.push({
        recordingId: recording.id,
        status: 'error',
        error: error.message,
      });
    }
  }

  // Revalidate the meeting page
  revalidatePath(`/workspace/${meetingData.workspaceId}/meeting/${meetingId}`);

  return {
    message: `Generated ${results.filter((r) => r.status === 'success').length} transcriptions`,
    updated: results.filter((r) => r.status === 'success').length,
    results,
  };
}
