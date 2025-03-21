import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getMeetingRecordings,
  getRecordingDownloadUrl,
  deleteRecording,
} from '@/lib/actions/meeting-recordings';
import {
  getMeetingOutcomes,
  deleteMeetingOutcome,
} from '@/lib/actions/meeting-outcomes';
import {
  getMeetingParticipants,
  removeParticipant,
} from '@/lib/actions/meeting-participants';
import { getWorkspaceMeetings, createMeeting } from '@/lib/actions/meeting';
import { toast } from 'sonner';

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
      queryClient.setQueriesData(
        { queryKey: ['recordings'] },
        (oldData: any[] | undefined) => {
          if (!oldData) return [];
          return oldData.filter((recording) => recording.id !== recordingId);
        }
      );
    },
    onError: (error) => {
      console.error('Error deleting recording:', error);
      toast.error('Failed to delete recording');
    },
  });
}

export function useRecordingDownloadUrl() {
  return useMutation({
    mutationFn: (recordingId: string) => getRecordingDownloadUrl(recordingId),
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
      queryClient.setQueriesData(
        { queryKey: ['outcomes'] },
        (oldData: any[] | undefined) => {
          if (!oldData) return [];
          return oldData.filter((outcome) => outcome.id !== outcomeId);
        }
      );
    },
    onError: (error) => {
      console.error('Failed to delete outcome:', error);
      toast.error('Failed to delete outcome');
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
    mutationFn: ({
      meetingId,
      userId,
    }: {
      meetingId: string;
      userId: string;
    }) => removeParticipant({ meetingId, userId }),
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
