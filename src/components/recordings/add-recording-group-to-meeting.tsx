'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ListPlus, Loader2 } from 'lucide-react';
import { DraftRecording } from '@/contexts/draft-recordings-context';
import { useQueryClient } from '@tanstack/react-query';
import { useWorkspaceMeetings } from '@/lib/hooks/use-queries';
import { getRecordingUploadUrl, addMeetingRecording } from '@/lib/actions/meeting-recordings';
import { formatDuration } from '@/lib/utils/recording-group-utils';
import CreateMeetingButton from '@/components/meetings/create-meeting-dialog';

interface AddRecordingGroupToMeetingProps {
  workspaceId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  recordings: DraftRecording[];
  groupName: string;
}

type Meeting = {
  id: string;
  title: string;
  createdAt: string;
  description?: string | null;
};

export function AddRecordingGroupToMeeting({
  workspaceId,
  onSuccess,
  onCancel,
  open,
  setOpen,
  recordings,
  groupName,
}: AddRecordingGroupToMeetingProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0);
  const [recordingName, setRecordingName] = useState(groupName);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [showMeetingCreateDialog, setShowMeetingCreateDialog] = useState(false);

  // Sort recordings by segmentIndex
  const sortedRecordings = [...recordings].sort((a, b) =>
    a.segmentIndex !== undefined && b.segmentIndex !== undefined
      ? a.segmentIndex - b.segmentIndex
      : 0
  );

  // Use React Query to load meetings
  const { data: fetchedMeetings = [], isLoading: isFetchingMeetings } = useWorkspaceMeetings(
    workspaceId && open ? workspaceId : ''
  );

  const meetings = fetchedMeetings.map((meeting) => ({
    id: meeting.id,
    title: meeting.title,
    description: meeting.description,
    createdAt: meeting.createdAt.toISOString(),
  }));

  // Calculate total duration of all recordings
  const totalDuration = recordings.reduce((sum, r) => sum + r.duration, 0);
  const formattedTotalDuration = formatDuration(totalDuration);

  // Handle new meeting creation
  const handleNewMeetingCreated = (newMeeting: any) => {
    setSelectedMeetingId(newMeeting.id);
    setShowMeetingCreateDialog(false);
  };

  // Handle upload of all segments
  const handleUpload = async () => {
    if (!selectedMeetingId || !recordingName) {
      toast.error('Please select a meeting and enter a recording name');
      return;
    }

    setIsUploading(true);
    setProgress(0);
    setCurrentUploadIndex(0);

    try {
      // Create a recording group for better organization in the database
      const groupId = recordings[0]?.groupId || crypto.randomUUID();

      // Upload each recording in sequence
      for (let i = 0; i < sortedRecordings.length; i++) {
        const recording = sortedRecordings[i];
        setCurrentUploadIndex(i);

        // Calculate segment name
        const segmentName =
          sortedRecordings.length > 1
            ? `${recordingName} (part ${i + 1} of ${sortedRecordings.length})`
            : recordingName;

        // Generate a filename
        const filename = `recording-${Date.now()}-seg${i}.mp3`;

        // Get a signed upload URL
        const urlRes = await getRecordingUploadUrl({
          meetingId: selectedMeetingId,
          fileName: filename,
          contentType: recording.blob.type || 'audio/mp3',
        });

        if (!urlRes.data) {
          throw new Error('Failed to get upload URL');
        }

        const uploadUrl = urlRes.data.uploadUrl;
        const fileKey = urlRes.data.fileKey;

        // Upload the file
        await fetch(uploadUrl, {
          method: 'PUT',
          body: recording.blob,
          headers: {
            'Content-Type': recording.blob.type || 'audio/mp3',
          },
        });

        // Add the recording to the meeting with segment metadata
        await addMeetingRecording({
          meetingId: selectedMeetingId,
          fileKey,
          recordingName: segmentName,
          duration: recording.formattedDuration || formatDuration(recording.duration),
          durationSeconds: recording.duration.toString(),
          addCurrentUserAsParticipant: true,
          groupId: groupId,
          segmentIndex: i,
          isSegmented: sortedRecordings.length > 1,
          totalSegments: sortedRecordings.length,
        });

        // Update progress
        setProgress(Math.round(((i + 1) / sortedRecordings.length) * 100));
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({
        queryKey: ['recordings', selectedMeetingId],
      });

      toast.success('Recordings added to meeting');

      // Call success callback
      onSuccess?.();

      // Navigate to the meeting
      router.push(`/workspace/${workspaceId}/meeting/${selectedMeetingId}`);

      // Reset state
      setIsUploading(false);
      setOpen(false);
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Failed to upload recordings');
      setIsUploading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(open) => !isUploading && setOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Recording Group to Meeting</DialogTitle>
            <DialogDescription>
              Add this segmented recording group containing {recordings.length} segments to a
              meeting.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="recording-name">Recording Name</Label>
              <Input
                id="recording-name"
                value={recordingName}
                onChange={(e) => setRecordingName(e.target.value)}
                placeholder="Enter recording name"
                disabled={isUploading}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Select Meeting</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => setShowMeetingCreateDialog(true)}
                  disabled={isUploading}
                >
                  <ListPlus className="mr-1 h-3 w-3" />
                  New Meeting
                </Button>
              </div>

              <Select
                value={selectedMeetingId || ''}
                onValueChange={(value) => setSelectedMeetingId(value)}
                disabled={isUploading}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={isFetchingMeetings ? 'Loading meetings...' : 'Select a meeting'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {isFetchingMeetings ? (
                    <SelectItem value="loading" disabled>
                      Loading meetings...
                    </SelectItem>
                  ) : meetings.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No meetings found
                    </SelectItem>
                  ) : (
                    meetings.map((meeting) => (
                      <SelectItem key={meeting.id} value={meeting.id}>
                        {meeting.title}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border p-3">
              <h4 className="mb-2 text-sm font-medium">Recording Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total duration:</span>
                  <span>{formattedTotalDuration}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Segments:</span>
                  <span>{recordings.length}</span>
                </div>
              </div>
            </div>

            {isUploading && (
              <div className="bg-muted/50 space-y-2 rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">
                    Uploading segment {currentUploadIndex + 1} of {recordings.length}...
                  </span>
                </div>
                <div className="bg-secondary h-2 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onCancel} disabled={isUploading}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={isUploading || !selectedMeetingId || !recordingName}
            >
              {isUploading ? 'Uploading...' : 'Upload Recording Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Meeting Dialog */}
      <CreateMeetingButton
        workspaceId={workspaceId}
        renderDialogOnly={true}
        dialogOpen={showMeetingCreateDialog}
        onDialogOpenChange={setShowMeetingCreateDialog}
        onMeetingCreated={handleNewMeetingCreated}
      />
    </>
  );
}
