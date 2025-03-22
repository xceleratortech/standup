'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Pause, Play, Square, Save } from 'lucide-react';
import { useMediaRecorder } from '@/hooks/use-media-recorder';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createMeeting } from '@/lib/actions/meeting';
import { useDraftRecordings } from '@/contexts/draft-recordings-context';

interface WorkspaceRecorderProps {
  workspaceId: string;
  meetings: { id: string; title: string }[];
}

export function WorkspaceRecorder({
  workspaceId,
  meetings,
}: WorkspaceRecorderProps) {
  const [openSaveDialog, setOpenSaveDialog] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>('');
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const router = useRouter();
  const { addDraftRecording } = useDraftRecordings();

  const {
    recordingState,
    recordedBlob,
    duration,
    error,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecording,
  } = useMediaRecorder({
    meetingId: workspaceId,
    onRecordingComplete: (blob, recordingDuration) => {
      // When recording completes, add it to drafts automatically
      if (addDraftRecording) {
        addDraftRecording(blob, recordingDuration);
      }

      // Show dialog to save/create meeting if needed
      setOpenSaveDialog(true);
    },
  });

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  // Format seconds to readable time
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Close dialog without saving - recording is already saved as draft
  const handleDialogClose = () => {
    setOpenSaveDialog(false);
    resetRecording();
    // Toast to inform user the recording is saved as draft
    toast.info(
      'Recording saved as draft. You can add it to any meeting later.'
    );
  };

  // Create a new meeting with this recording
  const handleCreateMeeting = async () => {
    if (!meetingTitle.trim()) {
      toast.error('Please enter a meeting title');
      return;
    }

    try {
      setIsCreatingMeeting(true);

      // Create new meeting
      const newMeeting = await createMeeting({
        workspaceId,
        title: meetingTitle,
        startTime: new Date(),
      });

      // Recording is already saved as draft, user can add it once in the meeting
      setOpenSaveDialog(false);
      resetRecording();

      // Navigate to the new meeting
      router.push(`/workspace/${workspaceId}/meeting/${newMeeting.id}`);

      toast.success(
        'New meeting created! You can add your recording from the Draft Recordings section.'
      );
    } catch (error) {
      console.error('Failed to create meeting:', error);
      toast.error('Failed to create meeting');
    } finally {
      setIsCreatingMeeting(false);
    }
  };

  // Go to existing meeting
  const handleGoToMeeting = () => {
    if (!selectedMeetingId) {
      toast.error('Please select a meeting');
      return;
    }

    setOpenSaveDialog(false);
    resetRecording();
    router.push(`/workspace/${workspaceId}/meeting/${selectedMeetingId}`);
    toast.success(
      'Navigate to meeting. You can add your recording from the Draft Recordings section.'
    );
  };

  return (
    <div className='flex items-center justify-center gap-6'>
      {/* Timer display */}
      {(recordingState === 'recording' || recordingState === 'paused') && (
        <div className='flex items-center font-mono text-xl'>
          <span
            className={
              recordingState === 'paused'
                ? 'text-muted-foreground'
                : recordingState === 'recording'
                  ? 'text-red-500'
                  : ''
            }
          >
            {formatDuration(duration)}
          </span>
          {recordingState === 'recording' && (
            <span className='ml-2 h-2 w-2 animate-pulse rounded-full bg-red-500' />
          )}
        </div>
      )}

      {/* Recording controls */}
      <div className='flex items-center space-x-2'>
        {recordingState === 'inactive' && (
          <Button
            onClick={startRecording}
            variant='outline'
            size='icon'
            className='h-12 w-12 rounded-full border-red-300 bg-red-100 hover:bg-red-200'
          >
            <Mic className='h-6 w-6 text-red-500' />
          </Button>
        )}

        {recordingState === 'recording' && (
          <>
            <Button
              onClick={pauseRecording}
              variant='outline'
              size='icon'
              className='h-10 w-10 rounded-full'
            >
              <Pause className='h-5 w-5' />
            </Button>
            <Button
              onClick={stopRecording}
              variant='outline'
              size='icon'
              className='h-12 w-12 rounded-full border-red-300 bg-red-100 hover:bg-red-200'
            >
              <Square className='h-5 w-5 text-red-500' />
            </Button>
          </>
        )}

        {recordingState === 'paused' && (
          <>
            <Button
              onClick={resumeRecording}
              variant='outline'
              size='icon'
              className='h-10 w-10 rounded-full'
            >
              <Play className='h-5 w-5' />
            </Button>
            <Button
              onClick={stopRecording}
              variant='outline'
              size='icon'
              className='h-12 w-12 rounded-full border-red-300 bg-red-100 hover:bg-red-200'
            >
              <Square className='h-5 w-5 text-red-500' />
            </Button>
          </>
        )}
      </div>

      {/* Save dialog */}
      <Dialog
        open={openSaveDialog}
        onOpenChange={(open) => {
          if (!open) handleDialogClose();
          setOpenSaveDialog(open);
        }}
      >
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Recording Complete</DialogTitle>
            <DialogDescription>
              Your recording has been automatically saved as a draft and won't
              be lost. Would you like to add it to a meeting now?
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-4 py-4'>
            <div className='grid grid-cols-4 items-center gap-4'>
              <Label htmlFor='meeting-select' className='col-span-4'>
                Add to existing meeting
              </Label>
              <Select
                value={selectedMeetingId}
                onValueChange={setSelectedMeetingId}
              >
                <SelectTrigger className='col-span-4'>
                  <SelectValue placeholder='Select a meeting' />
                </SelectTrigger>
                <SelectContent>
                  {meetings.length === 0 ? (
                    <SelectItem value='none' disabled>
                      No meetings available
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

            <div className='grid grid-cols-4 items-center gap-4'>
              <Label htmlFor='meeting-title' className='col-span-4'>
                Or create a new meeting
              </Label>
              <Input
                id='meeting-title'
                placeholder='Enter meeting title'
                className='col-span-4'
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className='flex justify-between sm:justify-between'>
            <Button
              variant='outline'
              onClick={handleDialogClose}
              disabled={isCreatingMeeting}
            >
              Use Later
            </Button>
            <div className='flex space-x-2'>
              <Button
                onClick={handleGoToMeeting}
                disabled={!selectedMeetingId || isCreatingMeeting}
              >
                Go to Meeting
              </Button>
              <Button
                onClick={handleCreateMeeting}
                disabled={!meetingTitle.trim() || isCreatingMeeting}
              >
                {isCreatingMeeting ? 'Creating...' : 'Create Meeting'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
