import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getMeetingRecordings,
  getRecordingDownloadUrl,
  deleteRecording,
  generateMissingTranscriptions,
  regenerateRecordingTranscription,
  updateRecordingTranscriptionJson,
  type Transcript,
} from '@/lib/actions/meeting-recordings';
import {
  getMeetingOutcomes,
  deleteMeetingOutcome,
  generateMeetingOutcome,
  updateMeetingOutcome,
} from '@/lib/actions/meeting-outcomes';
import { getMeetingParticipants, removeParticipant } from '@/lib/actions/meeting-participants';
import { getWorkspaceMeetings, createMeeting, getMeeting } from '@/lib/actions/meeting';
import { toast } from 'sonner';

import {
  getWorkspaceMembers,
  updateMemberRole,
  removeMember,
} from '@/lib/actions/workspace-members';
import { getVoiceIdentityUrl, getUserVoiceIdentity } from '@/lib/actions/workspace';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';

// Helper function to handle structured responses with proper type handling for different response formats
function extractData<T>(response: { data?: T; error?: string } | undefined): T | undefined {
  if (!response) return undefined;
  if ('error' in response && response.error) {
    console.error('Error in server action:', response.error);
    return undefined;
  }
  if ('data' in response) {
    return response.data;
  }
  return undefined;
}

// --- Recording hooks ---
export function useMeetingRecordings(meetingId: string) {
  return useQuery({
    queryKey: ['recordings', meetingId],
    queryFn: async () => {
      const response = await getMeetingRecordings(meetingId);
      const data = extractData(response);
      if (!data) throw new Error(response?.error || 'Failed to get recordings');
      return data;
    },
  });
}

export function useDeleteRecording() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recordingId: string) => {
      const response = await deleteRecording(recordingId);
      const data = extractData(response);
      if (!data) throw new Error(response?.error || 'Failed to delete recording');
      return data;
    },
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
      const response = await getRecordingDownloadUrl(recordingId);
      const data = extractData(response);
      if (!data) throw new Error(response?.error || 'Failed to get download URL');
      return data.downloadUrl;
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
      const response = await getVoiceIdentityUrl(fileKey);
      const data = extractData(response);
      if (!data) throw new Error(response?.error || 'Failed to get voice identity URL');

      const expiry = 3600;

      // Cache the URL with expiry time (default 1 hour/3600 seconds from S3.ts)
      urlCache.set(fileKey, {
        url: data.downloadUrl,
        expiry: now + expiry * 1000, // expiry time in milliseconds
      });

      return { downloadUrl: data.downloadUrl };
    },
  });
}

// Add a hook to manage voice identity operations
export function useVoiceIdentityOperations() {
  const queryClient = useQueryClient();

  return {
    invalidateVoiceIdentity: (workspaceId: string) => {
      queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['voiceIdentities', workspaceId] });
    },
  };
}

// Add new hook for managing multiple voice samples
export function useVoiceIdentities(workspaceId: string, userId?: string) {
  return useQuery({
    queryKey: ['voiceIdentities', workspaceId, userId],
    queryFn: async () => {
      const response = await getUserVoiceIdentity({ workspaceId, userId });
      const data = extractData(response);
      if (!data) throw new Error(response?.error || 'Failed to get voice identities');
      return data;
    },
    enabled: !!workspaceId,
  });
}

// --- Outcome hooks ---
export function useMeetingOutcomes(meetingId: string, focusUserId?: string | 'all') {
  return useQuery({
    queryKey: ['outcomes', meetingId, focusUserId],
    queryFn: async () => {
      const response = await getMeetingOutcomes(
        meetingId,
        focusUserId !== 'all' ? focusUserId : undefined
      );
      const data = extractData(response);
      if (!data) throw new Error(response?.error || 'Failed to get meeting outcomes');
      return data;
    },
  });
}

export function useDeleteOutcome() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (outcomeId: string) => {
      const response = await deleteMeetingOutcome(outcomeId);
      const data = extractData(response);
      if (!data) throw new Error(response?.error || 'Failed to delete outcome');
      return data;
    },
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

export function useUpdateOutcome() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      outcomeId,
      type,
      content,
    }: {
      outcomeId: string;
      type?: string;
      content?: string;
    }) => {
      const response = await updateMeetingOutcome({ outcomeId, type, content });
      const data = extractData(response);
      if (!data) throw new Error(response?.error || 'Failed to update outcome');
      return data;
    },
    onSuccess: () => {
      // Invalidate all meeting outcomes queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['meetingOutcomes'] });
    },
  });
}

// --- Generate outcome hook ---
export function useGenerateOutcome(meetingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      outcomeType,
      additionalPrompt,
      focusParticipantId,
    }: {
      outcomeType: 'summary' | 'actions';
      additionalPrompt?: string;
      focusParticipantId?: string;
    }) => {
      const response = await generateMeetingOutcome({
        meetingId,
        outcomeType,
        additionalPrompt,
        focusParticipantId,
      });
      const data = extractData(response);
      if (!data) throw new Error(response?.error || 'Failed to generate outcome');
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.type} generated successfully`);

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
    queryFn: async () => {
      const response = await getMeetingParticipants(meetingId);
      const data = extractData(response);
      if (!data) throw new Error(response?.error || 'Failed to get participants');
      return data;
    },
  });
}

export function useRemoveParticipant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ meetingId, userId }: { meetingId: string; userId: string }) => {
      const response = await removeParticipant({ meetingId, userId });
      const data = extractData(response);
      if (!data) throw new Error(response?.error || 'Failed to remove participant');
      return data;
    },
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
export function useMeeting(meetingId: string | undefined) {
  return useQuery({
    queryKey: ['meeting', meetingId],
    queryFn: async () => {
      if (!meetingId) throw new Error('Meeting ID is required');
      const response = await getMeeting(meetingId);
      const data = extractData(response);
      if (!data) throw new Error(response?.error || 'Failed to get meeting');
      return data;
    },
    enabled: !!meetingId,
  });
}

export function useWorkspaceMeetings(workspaceId: string) {
  return useQuery({
    queryKey: ['meetings', workspaceId],
    queryFn: async () => {
      const response = await getWorkspaceMeetings(workspaceId);
      const data = extractData(response);
      if (!data) throw new Error(response?.error || 'Failed to get workspace meetings');
      return data;
    },
    enabled: !!workspaceId,
  });
}

export function useCreateMeeting() {
  const queryClient = useQueryClient();

  const router = useRouter();

  return useMutation({
    mutationFn: async (meetingData: {
      workspaceId: string;
      title: string;
      description?: string;
      startTime?: Date;
    }) => {
      const response = await createMeeting(meetingData);
      const data = extractData(response);
      if (!data) throw new Error(response?.error || 'Failed to create meeting');
      router.refresh();
      return data;
    },
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
    queryFn: async () => {
      const response = await getWorkspaceMembers(workspaceId);
      const data = extractData(response);
      if (!data) throw new Error(response?.error || 'Failed to get workspace members');
      return data;
    },
    enabled: !!workspaceId,
  });
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workspaceId,
      userId,
      newRole,
    }: {
      workspaceId: string;
      userId: string;
      newRole: string;
    }) => {
      const response = await updateMemberRole({ workspaceId, userId, newRole });
      const data = extractData(response);
      if (!data) throw new Error(response?.error || 'Failed to update member role');
      return data;
    },
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
    mutationFn: async ({ workspaceId, userId }: { workspaceId: string; userId: string }) => {
      const response = await removeMember({ workspaceId, userId });
      const data = extractData(response);
      if (!data) throw new Error(response?.error || 'Failed to remove member');
      return data;
    },
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
export function useGenerateTranscriptions(meetingId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (forceRegenerate: boolean = false) => {
      if (!meetingId) throw new Error('Meeting ID is required');
      const response = await generateMissingTranscriptions(meetingId, forceRegenerate);
      // Handle the specific response format from the transcription generation
      if ('error' in response && response.error) {
        throw new Error(response.error);
      }
      return response.data;
    },
    onSuccess: (data) => {
      if (data && data.updated > 0) {
        toast.success(`Generated ${data.updated} transcriptions`);

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

// New hook for regenerating a single recording transcript
export function useRegenerateRecordingTranscription(meetingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recordingId: string) => {
      const response = await regenerateRecordingTranscription(recordingId);
      // Handle the specific response format
      if ('error' in response && response.error) {
        throw new Error(response.error);
      }
      return response.data;
    },
    onSuccess: (data) => {
      toast.success('Transcription regenerated successfully');

      // This will force a refetch of the recordings for the specific meeting
      queryClient.invalidateQueries({
        queryKey: ['recordings', meetingId],
      });
    },
    onError: (error) => {
      console.error('Failed to regenerate transcription:', error);
      toast.error('Failed to regenerate transcription');
    },
  });
}

// Add a function to be used by other mutations to trigger transcription generation
export function triggerTranscriptionGeneration(meetingId: string, queryClient: any) {
  // Call the server action directly
  generateMissingTranscriptions(meetingId)
    .then((response) => {
      // Check for error before accessing data
      if ('error' in response && response.error) {
        console.error('Failed to generate transcriptions:', response.error);
        return;
      }

      const data = response.data;
      if (data && data.updated > 0) {
        // Only show toast if transcriptions were actually generated
        toast.success(`Generated ${data.updated} transcriptions`);

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
  const participantsQuery = useMeetingParticipants(meetingId);

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

    if (!transcription || !participantsQuery.data) return result;

    const participants = participantsQuery.data;

    try {
      // Parse the transcript JSON
      const parsedTranscript = JSON.parse(transcription);

      let segments: any[] = [];

      // Handle both formats: array or object with segments property
      if (Array.isArray(parsedTranscript)) {
        segments = parsedTranscript;
      } else if (parsedTranscript && Array.isArray(parsedTranscript.segments)) {
        segments = parsedTranscript.segments;
      } else {
        return result;
      }

      // Get unique speakers from transcript
      const speakers = new Set<string>();
      segments.forEach((entry) => {
        if (entry.speaker) speakers.add(entry.speaker);
      });

      // Match speakers with participants or create placeholder entries
      speakers.forEach((speakerKey) => {
        // Check if it's an email format
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(speakerKey);

        if (isEmail) {
          // Look for matching participant by email
          const matchingParticipant = participants.find(
            (p: { email: string }) => p.email.toLowerCase() === speakerKey.toLowerCase()
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
  }, [transcription, participantsQuery.data]);

  return speakerMap;
}

// Hook to update a recording's transcription JSON
export function useUpdateRecordingTranscriptionJson(meetingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      recordingId,
      transcript,
    }: {
      recordingId: string;
      transcript: Transcript;
    }) => {
      const response = await updateRecordingTranscriptionJson({ recordingId, transcript });
      const data = extractData(response);
      if (!data) throw new Error(response?.error || 'Failed to update transcription');
      return data;
    },
    onSuccess: () => {
      // Invalidate and refetch the recordings
      queryClient.invalidateQueries({ queryKey: ['recordings', meetingId] });
      toast.success('Transcript updated successfully');
    },
    onError: (error) => {
      console.error('Error updating transcript:', error);
      toast.error(`Failed to update transcript: ${error.message}`);
    },
  });
}

// Find a participant by email with proper typing
export function useFindParticipantByEmail(
  email: string | undefined,
  participants:
    | Array<{ userId: string; role: string; name: string; email: string; image: string | null }>
    | undefined
) {
  return useMemo(() => {
    if (!email || !participants || !Array.isArray(participants)) return undefined;
    return participants.find(
      (p: { email: string }) => p.email.toLowerCase() === email.toLowerCase()
    );
  }, [email, participants]);
}
