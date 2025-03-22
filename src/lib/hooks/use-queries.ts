import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getMeetingRecordings,
  getRecordingDownloadUrl,
  deleteRecording,
  generateMissingTranscriptions,
} from '@/lib/actions/meeting-recordings';
import {
  getMeetingOutcomes,
  deleteMeetingOutcome,
  generateMeetingOutcome,
} from '@/lib/actions/meeting-outcomes';
import { getMeetingParticipants, removeParticipant } from '@/lib/actions/meeting-participants';
import { getWorkspaceMeetings, createMeeting } from '@/lib/actions/meeting';
import { toast } from 'sonner';

import {
  getWorkspaceMembers,
  updateMemberRole,
  removeMember,
} from '@/lib/actions/workspace-members';
import { getVoiceIdentityUrl } from '@/lib/actions/workspace';
import { getDownloadExpiry } from '@/lib/s3';
import { useMemo } from 'react';

// --- Recording hooks ---
export function useMeetingRecordings(meetingId: string) {
  return useQuery({
    queryKey: ['recordings', meetingId],
    queryFn: () => getMeetingRecordings(meetingId),
  });
}

export function useDeleteRecording() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recordingId: string) => deleteRecording(recordingId),
    onSuccess: (_, recordingId) => {
      toast.success('Recording deleted');
      // Update the recordings list
      queryClient.setQueriesData({ queryKey: ['recordings'] }, (oldData: any[] | undefined) => {
        if (!oldData) return [];
        return oldData.filter((recording) => recording.id !== recordingId);
      });

      // Trigger transcription generation after a short delay to allow state updates
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['recordings'] });
      }, 500);
    },
    onError: (error) => {
      console.error('Error deleting recording:', error);
      toast.error('Failed to delete recording');
    },
  });
}

// New utility function to store and manage URL expiration
const urlCache = new Map<string, { url: string; expiry: number }>();

export function useRecordingDownloadUrl() {
  return useMutation({
    mutationFn: async (recordingId: string) => {
      // Check if we have a cached URL that's not expired
      const cached = urlCache.get(recordingId);
      const now = Date.now();

      // If we have a valid cached URL (expiring more than 5 minutes from now)
      if (cached && cached.expiry > now + 5 * 60 * 1000) {
        return { downloadUrl: cached.url };
      }

      // Otherwise fetch a new URL
      const result = await getRecordingDownloadUrl(recordingId);

      // Cache the URL with expiry time (default 1 hour/3600 seconds from S3.ts)
      urlCache.set(recordingId, {
        url: result.downloadUrl,
        expiry: now + 3600 * 1000, // 1 hour in milliseconds
      });

      return result;
    },
  });
}

// --- Voice Identity hooks ---
export function useVoiceIdentityDownloadUrl() {
  return useMutation({
    mutationFn: async (fileKey: string) => {
      // Check if we have a cached URL that's not expired
      const cached = urlCache.get(fileKey);
      const now = Date.now();

      // If we have a valid cached URL (expiring more than 5 minutes from now)
      if (cached && cached.expiry > now + 5 * 60 * 1000) {
        return { downloadUrl: cached.url };
      }

      // Fetch a new URL
      const result = await getVoiceIdentityUrl(fileKey);
      const expiry = getDownloadExpiry();

      // Cache the URL with expiry time (default 1 hour/3600 seconds from S3.ts)
      urlCache.set(fileKey, {
        url: result.downloadUrl,
        expiry: now + expiry * 1000, // expiry time in milliseconds
      });

      return result;
    },
  });
}

// --- Outcome hooks ---
export function useMeetingOutcomes(meetingId: string) {
  return useQuery({
    queryKey: ['outcomes', meetingId],
    queryFn: () => getMeetingOutcomes(meetingId),
  });
}

export function useDeleteOutcome() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (outcomeId: string) => deleteMeetingOutcome(outcomeId),
    onSuccess: (_, outcomeId) => {
      toast.success('Outcome deleted');

      // Update the outcomes list
      queryClient.setQueriesData({ queryKey: ['outcomes'] }, (oldData: any[] | undefined) => {
        if (!oldData) return [];
        return oldData.filter((outcome) => outcome.id !== outcomeId);
      });
    },
    onError: (error) => {
      console.error('Failed to delete outcome:', error);
      toast.error('Failed to delete outcome');
    },
  });
}

// --- Generate outcome hook ---
export function useGenerateOutcome(meetingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      outcomeType,
      additionalPrompt,
    }: {
      outcomeType: 'summary' | 'actions';
      additionalPrompt?: string;
    }) => generateMeetingOutcome({ meetingId, outcomeType, additionalPrompt }),
    onSuccess: (newOutcome: any) => {
      toast.success(`${newOutcome.type} generated successfully`);

      // Update the outcomes list
      queryClient.invalidateQueries({
        queryKey: ['outcomes', meetingId],
      });
    },
    onError: (error: any) => {
      console.error('Failed to generate outcome:', error);
      toast.error(error.message || 'Failed to generate outcome');
    },
  });
}

// --- Participant hooks ---
export function useMeetingParticipants(meetingId: string) {
  return useQuery({
    queryKey: ['participants', meetingId],
    queryFn: () => getMeetingParticipants(meetingId),
  });
}

export function useRemoveParticipant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ meetingId, userId }: { meetingId: string; userId: string }) =>
      removeParticipant({ meetingId, userId }),
    onSuccess: (_, { meetingId, userId }) => {
      toast.success('Participant removed');

      // Update the participants list
      queryClient.setQueriesData(
        { queryKey: ['participants', meetingId] },
        (oldData: any[] | undefined) => {
          if (!oldData) return [];
          return oldData.filter((participant) => participant.userId !== userId);
        }
      );
    },
    onError: (error) => {
      console.error('Failed to remove participant:', error);
      toast.error('Failed to remove participant');
    },
  });
}

// --- Meeting hooks ---
export function useWorkspaceMeetings(workspaceId: string) {
  return useQuery({
    queryKey: ['meetings', workspaceId],
    queryFn: () => getWorkspaceMeetings(workspaceId),
    enabled: !!workspaceId,
  });
}

export function useCreateMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (meetingData: {
      workspaceId: string;
      title: string;
      description?: string;
      startTime?: Date;
    }) => createMeeting(meetingData),
    onSuccess: (newMeeting) => {
      toast.success('Meeting created');

      // Update the meetings list
      queryClient.invalidateQueries({
        queryKey: ['meetings', newMeeting.workspaceId],
      });
    },
    onError: (error) => {
      console.error('Failed to create meeting:', error);
      toast.error('Failed to create meeting');
    },
  });
}

// --- Workspace member hooks ---
export function useWorkspaceMembers(workspaceId: string) {
  return useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => getWorkspaceMembers(workspaceId),
    enabled: !!workspaceId,
  });
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workspaceId,
      userId,
      newRole,
    }: {
      workspaceId: string;
      userId: string;
      newRole: string;
    }) => updateMemberRole({ workspaceId, userId, newRole }),
    onSuccess: (_, { workspaceId }) => {
      toast.success('Member role updated');
      queryClient.invalidateQueries({
        queryKey: ['workspace-members', workspaceId],
      });
    },
    onError: (error) => {
      console.error('Failed to update member role:', error);
      toast.error('Failed to update member role');
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workspaceId, userId }: { workspaceId: string; userId: string }) =>
      removeMember({ workspaceId, userId }),
    onSuccess: (_, { workspaceId }) => {
      toast.success('Member removed');
      queryClient.invalidateQueries({
        queryKey: ['workspace-members', workspaceId],
      });
    },
    onError: (error) => {
      console.error('Failed to remove member:', error);
      toast.error('Failed to remove member');
    },
  });
}

// --- Transcription generation hook ---
export function useGenerateTranscriptions(meetingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => generateMissingTranscriptions(meetingId),
    onSuccess: (result) => {
      if (result.updated > 0) {
        toast.success(`Generated ${result.updated} transcriptions`);

        // Invalidate recordings query to reload with new transcriptions
        queryClient.invalidateQueries({
          queryKey: ['recordings', meetingId],
        });
      }
    },
    onError: (error) => {
      console.error('Failed to generate transcriptions:', error);
      toast.error('Failed to generate transcriptions');
    },
  });
}

// Add a function to be used by other mutations to trigger transcription generation
export function triggerTranscriptionGeneration(meetingId: string, queryClient: any) {
  // Call the server action directly
  generateMissingTranscriptions(meetingId)
    .then((result) => {
      if (result.updated > 0) {
        // Only show toast if transcriptions were actually generated
        toast.success(`Generated ${result.updated} transcriptions`);

        // Refresh recordings to show the new transcriptions
        queryClient.invalidateQueries({
          queryKey: ['recordings', meetingId],
        });
      }
    })
    .catch((error) => {
      console.error('Failed to generate transcriptions:', error);
    });
}

// --- Transcription speaker identification hook ---
export function useTranscriptSpeakers(meetingId: string, transcription: string | null | undefined) {
  const { data: participants = [] } = useMeetingParticipants(meetingId);

  // Process transcript to identify speakers and match with participants
  const speakerMap = useMemo(() => {
    const result = new Map<
      string,
      {
        userId?: string;
        name?: string | null;
        email?: string | null;
        image?: string | null;
        isParticipant: boolean;
      }
    >();

    if (!transcription) return result;

    try {
      // Parse the transcript JSON
      const parsedTranscript = JSON.parse(transcription);
      if (!Array.isArray(parsedTranscript)) return result;

      // Get unique speakers from transcript
      const speakers = new Set<string>();
      parsedTranscript.forEach((entry) => {
        if (entry.speaker) speakers.add(entry.speaker);
      });

      // Match speakers with participants or create placeholder entries
      speakers.forEach((speakerKey) => {
        // Check if it's an email format
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(speakerKey);

        if (isEmail) {
          // Look for matching participant by email
          const matchingParticipant = participants.find(
            (p) => p.email?.toLowerCase() === speakerKey.toLowerCase()
          );

          if (matchingParticipant) {
            result.set(speakerKey, {
              userId: matchingParticipant.userId,
              name: matchingParticipant.name,
              email: matchingParticipant.email,
              image: matchingParticipant.image,
              isParticipant: true,
            });
          } else {
            // Email, but not a participant
            result.set(speakerKey, {
              email: speakerKey,
              isParticipant: false,
            });
          }
        } else {
          // Not an email (like "Person 1")
          result.set(speakerKey, {
            name: speakerKey,
            isParticipant: false,
          });
        }
      });
    } catch (error) {
      console.error('Error parsing transcript:', error);
    }

    return result;
  }, [transcription, participants]);

  return speakerMap;
}
