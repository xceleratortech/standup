'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Play, Pause, Trash2, Download, FilePlus } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useQueryClient } from '@tanstack/react-query';
import {
  useMeetingRecordings,
  useDeleteRecording,
  useRecordingDownloadUrl,
} from '@/lib/hooks/use-queries';

interface Recording {
  id: string;
  meetingId: string;
  fileKey: string;
  recordingUrl: string | null;
  recordingName: string | null;
  duration?: string | null;
  durationSeconds?: string | null;
  createdAt: Date;
  createdById: string;
  updatedAt?: Date;
}

interface RecordingListProps {
  meetingId: string;
  canEdit: boolean;
}

export function RecordingList({ meetingId, canEdit }: RecordingListProps) {
  const queryClient = useQueryClient();
  const { data: recordings = [], isLoading: loading } =
    useMeetingRecordings(meetingId);
  const { mutateAsync: getDownloadUrl } = useRecordingDownloadUrl();
  const deleteRecordingMutation = useDeleteRecording();

  const [playing, setPlaying] = useState<string | null>(null);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [recordingToDelete, setRecordingToDelete] = useState<string | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);

  // Add an effect to refresh recordings when the component mounts
  useEffect(() => {
    // Invalidate and refetch recordings
    queryClient.invalidateQueries({ queryKey: ['recordings', meetingId] });
  }, [queryClient, meetingId]);

  // Handle playing audio
  useEffect(() => {
    if (playing) {
      const recording = recordings.find((r) => r.id === playing);
      if (recording && recording.recordingUrl) {
        const newAudio = new Audio(recording.recordingUrl);
        newAudio.onended = () => setPlaying(null);
        newAudio.play();
        setAudio(newAudio);

        return () => {
          newAudio.pause();
        };
      }
    } else if (audio) {
      audio.pause();
      setAudio(null);
    }
  }, [playing, recordings, audio]);

  // Toggle play/pause
  const togglePlay = async (id: string) => {
    try {
      if (playing === id) {
        setPlaying(null);
      } else {
        // If there's already something playing, stop it first
        if (playing) {
          setPlaying(null);
          setTimeout(async () => {
            // Get fresh URL before playing
            const { downloadUrl } = await getDownloadUrl(id);

            // Update the URL in our state
            queryClient.setQueryData(
              ['recordings', meetingId],
              (oldData: any) => {
                return oldData.map((rec: Recording) =>
                  rec.id === id ? { ...rec, recordingUrl: downloadUrl } : rec
                );
              }
            );

            setPlaying(id);
          }, 50);
        } else {
          // Get fresh URL before playing
          const { downloadUrl } = await getDownloadUrl(id);

          // Update the URL in our state
          queryClient.setQueryData(
            ['recordings', meetingId],
            (oldData: any) => {
              return oldData.map((rec: Recording) =>
                rec.id === id ? { ...rec, recordingUrl: downloadUrl } : rec
              );
            }
          );

          setPlaying(id);
        }
      }
    } catch (error) {
      console.error('Error playing recording:', error);
      toast.error('Failed to play recording');
    }
  };

  // Handle download
  const handleDownload = async (id: string) => {
    try {
      const { downloadUrl } = await getDownloadUrl(id);
      const recording = recordings.find((r) => r.id === id);

      if (recording) {
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${recording.recordingName || 'recording'}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error downloading recording:', error);
      toast.error('Failed to download recording');
    }
  };

  // Confirm deletion
  const confirmDelete = (id: string) => {
    setRecordingToDelete(id);
  };

  // Handle delete
  const handleDelete = async () => {
    if (!recordingToDelete) return;

    try {
      setIsDeleting(true);
      await deleteRecordingMutation.mutateAsync(recordingToDelete);
      setRecordingToDelete(null);
    } catch (error) {
      console.error('Error deleting recording:', error);
      toast.error('Failed to delete recording');
    } finally {
      setIsDeleting(false);
    }
  };

  // Format duration
  const formatDuration = (
    duration?: string | null,
    durationSeconds?: string | null
  ) => {
    // If we have a formatted duration, use it
    if (duration && duration.includes(':')) {
      return duration;
    }

    // If we have durationSeconds, format it
    if (durationSeconds) {
      const seconds = parseInt(durationSeconds, 10);
      if (!isNaN(seconds)) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
      }
    }

    // Fallback for old recordings or if formatting fails
    return duration || 'Unknown';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <FilePlus className='h-5 w-5' />
          Recordings
        </CardTitle>
        <CardDescription>
          Audio recordings associated with this meeting
        </CardDescription>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className='space-y-2'>
            <Skeleton className='h-12 w-full' />
            <Skeleton className='h-12 w-full' />
          </div>
        ) : recordings.length === 0 ? (
          <Alert>
            <AlertDescription>
              No recordings have been added to this meeting yet.
            </AlertDescription>
          </Alert>
        ) : (
          <div className='space-y-3'>
            {recordings.map((recording) => (
              <div
                key={recording.id}
                className='hover:bg-accent/50 flex items-center justify-between rounded-md border p-2'
              >
                <div className='flex items-center gap-2'>
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={() => togglePlay(recording.id)}
                  >
                    {playing === recording.id ? (
                      <Pause className='h-4 w-4' />
                    ) : (
                      <Play className='h-4 w-4' />
                    )}
                  </Button>

                  <div>
                    <p className='font-medium'>
                      {recording.recordingName || 'Unnamed Recording'}
                    </p>
                    <div className='text-muted-foreground flex items-center gap-2 text-sm'>
                      <span>
                        {formatDuration(
                          recording.duration,
                          recording.durationSeconds
                        )}
                      </span>
                      <span>•</span>
                      <span>
                        {formatDistanceToNow(new Date(recording.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className='flex items-center gap-2'>
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={() => handleDownload(recording.id)}
                  >
                    <Download className='h-4 w-4' />
                  </Button>

                  {canEdit && (
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={() => confirmDelete(recording.id)}
                    >
                      <Trash2 className='text-destructive h-4 w-4' />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!recordingToDelete}
        onOpenChange={(open) => !open && setRecordingToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recording</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this recording from the meeting. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
