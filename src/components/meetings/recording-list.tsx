'use client';

import { formatDistanceToNow } from 'date-fns';
import { Mic, Play, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  useMeetingRecordings,
  useRecordingDownloadUrl,
  useDeleteRecording,
} from '@/lib/hooks/use-queries';
import { Spinner } from '@/components/ui/spinner';

interface RecordingListProps {
  meetingId: string;
  canEdit: boolean;
}

export function RecordingList({ meetingId, canEdit }: RecordingListProps) {
  const {
    data: recordings,
    isLoading,
    error,
  } = useMeetingRecordings(meetingId);
  const { mutateAsync: getDownloadUrl } = useRecordingDownloadUrl();
  const { mutate: deleteRecordingMutation, isPending: isDeleting } =
    useDeleteRecording();
  const [playingId, setPlayingId] = useState<string | null>(null);

  async function handleDownload(recordingId: string) {
    try {
      const { downloadUrl } = await getDownloadUrl(recordingId);

      // Create a temporary link and click it to start the download
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = 'recording.webm';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading recording:', error);
      toast.error('Failed to download recording');
    }
  }

  async function playRecording(recordingId: string) {
    try {
      setPlayingId(recordingId);
      const { downloadUrl } = await getDownloadUrl(recordingId);

      // Create an audio element and play it
      const audio = new Audio(downloadUrl);
      audio.onended = () => setPlayingId(null);
      audio.play();
    } catch (error) {
      console.error('Error playing recording:', error);
      toast.error('Failed to play recording');
      setPlayingId(null);
    }
  }

  if (isLoading) {
    return (
      <div className='flex justify-center py-8'>
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className='text-destructive border-destructive/20 bg-destructive/10 rounded-md border p-4 text-center'>
        Error loading recordings:{' '}
        {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  if (!recordings || recordings.length === 0) {
    return (
      <div className='text-muted-foreground py-8 text-center'>
        No recordings available for this meeting.
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      <h3 className='text-lg font-medium'>Recordings</h3>
      <div className='divide-y rounded-md border'>
        {recordings.map((recording) => (
          <div
            key={recording.id}
            className='flex items-center justify-between p-4'
          >
            <div className='flex items-center gap-3'>
              <div className='bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full'>
                <Mic className='text-primary h-5 w-5' />
              </div>
              <div>
                <p className='font-medium'>
                  {recording.recordingName || 'Recording'}
                </p>
                <p className='text-muted-foreground text-xs'>
                  {formatDistanceToNow(new Date(recording.createdAt), {
                    addSuffix: true,
                  })}
                  {recording.duration && ` · ${recording.duration}`}
                </p>
              </div>
            </div>

            <div className='flex gap-2'>
              <Button
                variant='outline'
                size='icon'
                onClick={() => playRecording(recording.id)}
                disabled={playingId === recording.id}
              >
                {playingId === recording.id ? (
                  <Spinner className='h-4 w-4' />
                ) : (
                  <Play className='h-4 w-4' />
                )}
              </Button>
              <Button
                variant='outline'
                size='icon'
                onClick={() => handleDownload(recording.id)}
              >
                <Download className='h-4 w-4' />
              </Button>
              {canEdit && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant='outline' size='icon' disabled={isDeleting}>
                      <Trash2 className='text-destructive h-4 w-4' />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Recording</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this recording? This
                        action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={(e) => {
                          e.preventDefault();
                          deleteRecordingMutation(recording.id);
                        }}
                        className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
