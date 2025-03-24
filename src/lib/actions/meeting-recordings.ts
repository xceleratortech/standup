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
import {
  getTranscriptionFromAudioFile,
  identifyParticipantsFromAudio,
} from '@/lib/actions/ai/generate';
import { user } from '../db/auth-schema';
import { voiceSampleTexts } from '../config/voice-samples';

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

// Define a type for transcript segments
export interface TranscriptSegment {
  speaker: string;
  text: string;
  timestamp: string;
  startTimeSeconds?: number;
}

// Define a type for the full transcript
export interface Transcript {
  segments?: TranscriptSegment[];
}

// Update a recording's transcription JSON
export async function updateRecordingTranscriptionJson({
  recordingId,
  transcript,
}: {
  recordingId: string;
  transcript: Transcript | TranscriptSegment[];
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

  // Check if user has permissions to update
  const participant = await db.query.meetingParticipant.findFirst({
    where: and(
      eq(meetingParticipant.meetingId, recordingData.meetingId),
      eq(meetingParticipant.userId, userId)
    ),
  });

  const canUpdate =
    userWorkspace.role === 'admin' ||
    meetingData.createdById === userId ||
    participant?.role === 'organizer' ||
    participant?.role === 'editor';

  if (!canUpdate) {
    throw new Error("You don't have permission to update this recording");
  }

  // Validate transcript format
  if (Array.isArray(transcript)) {
    // Array format validation
    if (
      !transcript.length ||
      !transcript[0].speaker ||
      !transcript[0].timestamp ||
      !transcript[0].text
    ) {
      throw new Error(
        'Invalid transcript format: segments must have speaker, timestamp, and text properties'
      );
    }
  } else if (
    !transcript ||
    !Array.isArray(transcript.segments) ||
    transcript.segments.length === 0
  ) {
    throw new Error("Invalid transcript format: 'segments' array is required");
  }

  // Format the transcript as a JSON string
  const transcriptionJson = JSON.stringify(transcript, null, 2);

  // Update the transcription
  await db
    .update(meetingRecording)
    .set({
      transcription: transcriptionJson,
      updatedAt: new Date(),
    })
    .where(eq(meetingRecording.id, recordingId));

  revalidatePath(`/workspace/${meetingData.workspaceId}/meeting/${recordingData.meetingId}`);
  return { success: true };
}

// Helper function to get meeting data and validate user access
async function getMeetingAndValidateAccess(meetingId: string) {
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

  return { meetingData, userId, userWorkspace };
}

// Helper function to get participants with voice samples
async function getParticipantsWithVoiceSamples(meetingId: string, workspaceId: string) {
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
        eq(userVoiceIdentity.workspaceId, workspaceId),
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

  return participantsWithVoices;
}

// Define types for participants and content items
interface VoiceSample {
  fileKey: string;
  sampleName: string;
}

interface ParticipantWithVoice {
  userId: string;
  name: string;
  email: string;
  voiceSamples: VoiceSample[];
}

type ContentItemType = 'prompt' | 'audiofile';

interface ContentItem {
  type: ContentItemType;
  content: string;
}

// Helper function to create content items for transcription
function createTranscriptionContentItems(
  participantsWithVoices: ParticipantWithVoice[],
  recordingFileKey: string
): ContentItem[] {
  const contentItems: ContentItem[] = [];

  // Add intro prompt
  contentItems.push({
    type: 'prompt',
    content: `I'll provide voice samples of potential meeting participants.
Please use these voice samples to accurately identify speakers in the meeting recording.
DO NOT INCLUDE THESE IN THE TRANSCRIPTION.`,
  });

  // Add voice samples with their identifying information
  if (participantsWithVoices.length > 0) {
    for (const participant of participantsWithVoices) {
      // Add each voice sample for this participant
      contentItems.push({
        type: 'prompt',
        content: `Below are Voice samples for ${participant.name} (${participant.email}):`,
      });
      for (const sample of participant.voiceSamples) {
        // Add the voice sample file
        contentItems.push({
          type: 'audiofile',
          content: sample.fileKey,
        });
      }
      // Add prompt identifying this voice
      contentItems.push({
        type: 'prompt',
        content: `The voice samples above belong to: ${participant.name} (${participant.email})`,
      });
    }
  }

  // Add final instructions
  contentItems.push({
    type: 'prompt',
    content: `
IMPORTANT INSTRUCTIONS:

1. The voice samples I provided above belong to potential meeting participants.
2. Your task is to transcribe ONLY the meeting recording that follows these instructions.
3. DO NOT include transcriptions of the voice samples in your output.

When creating the transcription:
- Listen to the meeting recording carefully
- Match speakers to the voice samples when possible
- If a speaker matches a voice sample, use their email as identifier (example: "speaker": "john@example.com")
- If a speaker doesn't match any sample, label them as "Person 1", "Person 2", etc.
- Include timestamps (example: "00:01:30")
- Include pauses, laughs, sighs and other non-verbal sounds in brackets
- If someone states their name in the meeting, you can use it instead of "Person X"

Format your output as valid JSON.`,
  });

  // Add the main recording file
  contentItems.push({
    type: 'audiofile',
    content: recordingFileKey,
  });

  return contentItems;
}

// Generate transcriptions for all recordings in a meeting that don't have them
export async function generateMissingTranscriptions(
  meetingId: string,
  forceRegenerate: boolean = false
) {
  const { meetingData, userId } = await getMeetingAndValidateAccess(meetingId);

  // Get recordings for this meeting based on the forceRegenerate flag
  const recordings = forceRegenerate
    ? await db.select().from(meetingRecording).where(eq(meetingRecording.meetingId, meetingId))
    : await db
        .select()
        .from(meetingRecording)
        .where(
          and(eq(meetingRecording.meetingId, meetingId), isNull(meetingRecording.transcription))
        );

  if (recordings.length === 0) {
    return { message: 'No recordings need transcription', updated: 0 };
  }

  // Get participants with voice samples
  const participantsWithVoices = await getParticipantsWithVoiceSamples(
    meetingId,
    meetingData.workspaceId
  );

  // Process each recording
  const results = [];
  for (const recording of recordings) {
    try {
      // Create content items for transcription
      const contentItems = createTranscriptionContentItems(
        participantsWithVoices,
        recording.fileKey
      );

      // Generate transcription with the ordered content items
      const transcription = await getTranscriptionFromAudioFile(contentItems);

      // Update the recording with the transcription
      await db
        .update(meetingRecording)
        .set({
          transcription,
          updatedAt: new Date(),
          transcriptionGeneratedAt: new Date(), // Set the generation timestamp
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

// New function to regenerate transcript for a specific recording
export async function regenerateRecordingTranscription(recordingId: string) {
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

  // Get the meeting and validate access
  const { meetingData } = await getMeetingAndValidateAccess(recordingData.meetingId);

  // Get participants with voice samples
  const participantsWithVoices = await getParticipantsWithVoiceSamples(
    recordingData.meetingId,
    meetingData.workspaceId
  );

  try {
    // Create content items for transcription
    const contentItems = createTranscriptionContentItems(
      participantsWithVoices,
      recordingData.fileKey
    );

    // Generate transcription with the ordered content items
    const transcription = await getTranscriptionFromAudioFile(contentItems);

    // Update the recording with the transcription
    await db
      .update(meetingRecording)
      .set({
        transcription,
        updatedAt: new Date(),
        transcriptionGeneratedAt: new Date(), // Set the generation timestamp
      })
      .where(eq(meetingRecording.id, recordingData.id));

    revalidatePath(`/workspace/${meetingData.workspaceId}/meeting/${recordingData.meetingId}`);
    return { success: true, recordingId: recordingData.id };
  } catch (error: any) {
    console.error(`Error regenerating transcription for recording ${recordingData.id}:`, error);
    throw new Error(`Failed to regenerate transcription: ${error.message}`);
  }
}

// Helper function to create content items for participant identification
function createParticipantIdentificationContentItems(
  participantsWithVoices: ParticipantWithVoice[],
  recordingFileKey: string
): ContentItem[] {
  const contentItems: ContentItem[] = [];

  // Add intro prompt
  contentItems.push({
    type: 'prompt',
    content: `I'll provide voice samples of potential meeting participants followed by a meeting recording.
Please identify which of these people actually participated in the meeting based on their voice.
Your goal is to return a list of emails ONLY for those people whose voices are heard in the meeting recording.`,
  });

  // Add voice samples with their identifying information
  if (participantsWithVoices.length > 0) {
    for (const participant of participantsWithVoices) {
      // Add each voice sample for this participant
      contentItems.push({
        type: 'prompt',
        content: `Below are Voice samples for ${participant.name} (${participant.email}):`,
      });
      for (const sample of participant.voiceSamples) {
        // Add the voice sample file
        contentItems.push({
          type: 'audiofile',
          content: sample.fileKey,
        });
      }
      // Add prompt identifying this voice
      contentItems.push({
        type: 'prompt',
        content: `The voice samples above belong to: ${participant.name} (${participant.email})`,
      });
    }
  }

  contentItems.push({
    type: 'prompt',
    content: `
The above voice samples were more or less trying to say the following:
${voiceSampleTexts.join('\n')}

Now that you know what the samples sound like and what they transcribe to, this should help you better identify them and what they say in the meeting recording.
This could be their accent or the way they pronounce certain words.

Now I'll provide the meeting recording below. Please listen carefully and return ONLY an array of email addresses for people who actually spoke during this meeting.
If someone's voice from the samples above is heard in the meeting, include their email in the response.
If a voice in the meeting doesn't match any of the provided samples, don't include them.
Format the output as a JSON array of email strings.`,
  });

  // Add the main recording file
  contentItems.push({
    type: 'audiofile',
    content: recordingFileKey,
  });

  return contentItems;
}

// Server action to identify and add participants
export async function identifyAndAddMeetingParticipants(meetingId: string, recordingId: string) {
  const { meetingData, userId, userWorkspace } = await getMeetingAndValidateAccess(meetingId);

  // Check if user has permission to add participants
  const canUpdate = userWorkspace.role === 'admin' || meetingData.createdById === userId;

  if (!canUpdate) {
    throw new Error("You don't have permission to update meeting participants");
  }

  // Get the recording
  const recordingData = await db.query.meetingRecording.findFirst({
    where: eq(meetingRecording.id, recordingId),
  });

  if (!recordingData) {
    throw new Error('Recording not found');
  }

  // Get all workspace users with voice samples
  const allWorkspaceUsers = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
    })
    .from(user)
    .innerJoin(workspaceUser, eq(user.id, workspaceUser.userId))
    .where(eq(workspaceUser.workspaceId, meetingData.workspaceId));

  // Get current meeting participants
  const currentParticipants = await db
    .select({
      userId: meetingParticipant.userId,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    })
    .from(meetingParticipant)
    .innerJoin(user, eq(meetingParticipant.userId, user.id))
    .where(eq(meetingParticipant.meetingId, meetingId));

  // Create a set of current participant IDs for easy lookup
  const currentParticipantIds = new Set(currentParticipants.map((p) => p.userId));

  // Filter to workspace users who are not already participants
  const potentialNewParticipants = allWorkspaceUsers.filter(
    (u) => !currentParticipantIds.has(u.id)
  );

  if (potentialNewParticipants.length === 0) {
    return { message: 'All workspace users are already participants', added: 0 };
  }

  // Get voice samples for all potential new participants
  const potentialParticipantIds = potentialNewParticipants.map((u) => u.id);

  const voiceIdentities = await db
    .select()
    .from(userVoiceIdentity)
    .where(
      and(
        eq(userVoiceIdentity.workspaceId, meetingData.workspaceId),
        inArray(userVoiceIdentity.userId, potentialParticipantIds)
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

  // Map potential participants with their voice samples
  const potentialParticipantsWithVoices = potentialNewParticipants
    .map((u) => {
      const userSamples = voiceSamplesByUser[u.id] || [];
      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        voiceSamples: userSamples.map((sample) => ({
          fileKey: sample.fileKey,
          sampleName: sample.sampleName || 'Voice Sample',
        })),
      };
    })
    .filter((p) => p.voiceSamples.length > 0); // Only include those with voice samples

  if (potentialParticipantsWithVoices.length === 0) {
    return { message: 'No potential new participants with voice samples', added: 0 };
  }

  try {
    // Create content items for participant identification
    const contentItems = createParticipantIdentificationContentItems(
      potentialParticipantsWithVoices,
      recordingData.fileKey
    );

    // Identify participants from the audio
    const participantEmails = await identifyParticipantsFromAudio(contentItems);

    if (participantEmails.length === 0) {
      return { message: 'No new participants identified in the recording', added: 0 };
    }

    // Find the user IDs for the identified emails
    const emailToUserMap = potentialParticipantsWithVoices.reduce(
      (acc, p) => {
        acc[p.email.toLowerCase()] = p.userId;
        return acc;
      },
      {} as Record<string, string>
    );

    // Prepare to add new participants
    const newParticipantIds = participantEmails
      .map((email) => emailToUserMap[email.toLowerCase()])
      .filter(Boolean); // Remove any undefined entries

    if (newParticipantIds.length === 0) {
      return { message: 'No matching users found for identified participants', added: 0 };
    }

    // Add the new participants to the meeting
    const insertData = newParticipantIds.map((userId) => ({
      meetingId,
      userId,
    }));

    await db.insert(meetingParticipant).values(insertData);

    // Revalidate the meeting page
    revalidatePath(`/workspace/${meetingData.workspaceId}/meeting/${meetingId}`);

    return {
      message: `Added ${newParticipantIds.length} new participants to the meeting`,
      added: newParticipantIds.length,
      emails: participantEmails,
    };
  } catch (error: any) {
    console.error('Error identifying and adding participants:', error);
    throw new Error(`Failed to identify and add participants: ${error.message}`);
  }
}
