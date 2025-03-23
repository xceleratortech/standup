'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Download, FilePlus, ChevronDown, ChevronUp, Play, Pause } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatePresence, motion } from 'framer-motion';
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
import { AudioPlayer } from '@/components/ui/audio-player';
import {
  useMeetingRecordings,
  useDeleteRecording,
  useRecordingDownloadUrl,
  useGenerateTranscriptions,
} from '@/lib/hooks/use-queries';
import RecordingTranscript from './recording-transcript';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  transcription?: string | null;
}

interface RecordingListProps {
  meetingId: string;
  canEdit: boolean;
}

export function RecordingList({ meetingId, canEdit }: RecordingListProps) {
  const queryClient = useQueryClient();
  const { data: recordings = [], isLoading: loading } = useMeetingRecordings(meetingId);
  const { mutateAsync: getDownloadUrl } = useRecordingDownloadUrl();
  const deleteRecordingMutation = useDeleteRecording();
  const { mutate: generateTranscriptions, isPending: isGeneratingTranscriptions } =
    useGenerateTranscriptions(meetingId);

  const [playing, setPlaying] = useState<string | null>(null);
  const [recordingURLs, setRecordingURLs] = useState<Record<string, string>>({});
  const [expandedRecordings, setExpandedRecordings] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<Record<string, string>>({});
  const [recordingToDelete, setRecordingToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPlaybackTimes, setCurrentPlaybackTimes] = useState<Record<string, number>>({});

  // Add an effect to refresh recordings when the component mounts or when recordings change
  useEffect(() => {
    // Invalidate and refetch recordings
    queryClient.invalidateQueries({ queryKey: ['recordings', meetingId] });

    // Check for recordings without transcriptions and generate them
    generateTranscriptions();
  }, [queryClient, meetingId, generateTranscriptions, recordings.length]);

  // Handler for audio time updates
  const handleTimeUpdate = (recordingId: string, currentTime: number) => {
    setCurrentPlaybackTimes((prev) => ({
      ...prev,
      [recordingId]: currentTime,
    }));
  };

  // Toggle play/pause for a recording
  const togglePlay = async (e: React.MouseEvent, recordingId: string) => {
    // Stop event from expanding/collapsing the recording
    e.stopPropagation();

    try {
      if (playing === recordingId) {
        // Pause current recording
        setPlaying(null);
      } else {
        // If we don't have the URL yet, fetch it
        if (!recordingURLs[recordingId]) {
          const { downloadUrl } = await getDownloadUrl(recordingId);
          setRecordingURLs((prev) => ({
            ...prev,
            [recordingId]: downloadUrl,
          }));
        }

        // Expand the recording if it's not already expanded
        if (!expandedRecordings[recordingId]) {
          setExpandedRecordings((prev) => ({
            ...prev,
            [recordingId]: true,
          }));

          // Set default active tab
          setActiveTab((prev) => ({
            ...prev,
            [recordingId]: 'audio',
          }));
        }

        // Play the recording
        setPlaying(recordingId);
      }
    } catch (error) {
      console.error('Error toggling play state:', error);
      toast.error('Failed to play recording');
    }
  };

  // Handle download
  const handleDownload = async (e: React.MouseEvent, recordingId: string) => {
    e.stopPropagation();

    try {
      // Use the cached URL if available
      let downloadUrl = recordingURLs[recordingId];

      if (!downloadUrl) {
        const result = await getDownloadUrl(recordingId);
        downloadUrl = result.downloadUrl;

        // Cache the URL
        setRecordingURLs((prev) => ({
          ...prev,
          [recordingId]: downloadUrl,
        }));
      }

      const recording = recordings.find((r) => r.id === recordingId);

      if (recording) {
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${recording.recordingName || 'recording'}.mp3`;
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
  const confirmDelete = (e: React.MouseEvent, recordingId: string) => {
    e.stopPropagation();
    setRecordingToDelete(recordingId);
  };

  // Handle delete
  const handleDelete = async () => {
    if (!recordingToDelete) return;

    try {
      setIsDeleting(true);
      await deleteRecordingMutation.mutateAsync(recordingToDelete);

      // Clear URL from our cache if this recording was deleted
      setRecordingURLs((prev) => {
        const updated = { ...prev };
        delete updated[recordingToDelete];
        return updated;
      });

      // If this was the playing recording, stop playback
      if (playing === recordingToDelete) {
        setPlaying(null);
      }

      setRecordingToDelete(null);
    } catch (error) {
      console.error('Error deleting recording:', error);
      toast.error('Failed to delete recording');
    } finally {
      setIsDeleting(false);
    }
  };

  // Parse duration to seconds
  const getDurationInSeconds = (
    duration?: string | null,
    durationSeconds?: string | null
  ): number | undefined => {
    // If we have durationSeconds directly, use that
    if (durationSeconds) {
      const seconds = parseInt(durationSeconds, 10);
      if (!isNaN(seconds)) {
        return seconds;
      }
    }

    // Try to parse from formatted duration (e.g. "1:30")
    if (duration && duration.includes(':')) {
      const parts = duration.split(':');
      if (parts.length === 2) {
        const minutes = parseInt(parts[0], 10);
        const seconds = parseInt(parts[1], 10);
        if (!isNaN(minutes) && !isNaN(seconds)) {
          return minutes * 60 + seconds;
        }
      }
    }

    return undefined;
  };

  // Format duration
  const formatDuration = (duration?: string | null, durationSeconds?: string | null) => {
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

  // Toggle recording expansion state
  const toggleExpand = async (recordingId: string) => {
    try {
      const isCurrentlyExpanded = expandedRecordings[recordingId];

      // If expanding and we don't have the URL yet, fetch it
      if (!isCurrentlyExpanded && !recordingURLs[recordingId]) {
        const { downloadUrl } = await getDownloadUrl(recordingId);
        setRecordingURLs((prev) => ({
          ...prev,
          [recordingId]: downloadUrl,
        }));
      }

      // Toggle expanded state
      setExpandedRecordings((prev) => ({
        ...prev,
        [recordingId]: !prev[recordingId],
      }));

      // Set default active tab for newly expanded recordings
      const recording = recordings.find((r) => r.id === recordingId);
      if (!isCurrentlyExpanded && recording?.transcription && !activeTab[recordingId]) {
        setActiveTab((prev) => ({
          ...prev,
          [recordingId]: 'audio', // Default to audio tab
        }));
      }
    } catch (error) {
      console.error('Error fetching recording URL:', error);
      toast.error('Failed to load recording');
    }
  };

  // Play from a specific segment in transcript
  const handlePlaySegment = (recordingId: string, timeInSeconds: number) => {
    // If we don't have the URL yet, fetch it first
    if (!recordingURLs[recordingId]) {
      toast.loading('Loading audio...');

      getDownloadUrl(recordingId)
        .then(({ downloadUrl }) => {
          toast.dismiss();
          setRecordingURLs((prev) => ({
            ...prev,
            [recordingId]: downloadUrl,
          }));

          // Make sure the recording is expanded and set to transcript tab
          setExpandedRecordings((prev) => ({
            ...prev,
            [recordingId]: true,
          }));

          setActiveTab((prev) => ({
            ...prev,
            [recordingId]: 'transcript',
          }));

          setTimeout(() => {
            startPlayback(recordingId, timeInSeconds);
          }, 300);
        })
        .catch((error) => {
          toast.dismiss();
          console.error('Error loading recording URL:', error);
          toast.error('Failed to load recording');
        });
    } else {
      // URL already loaded, just play
      startPlayback(recordingId, timeInSeconds);
    }
  };

  function startPlayback(recordingId: string, timeInSeconds: number) {
    // Set time first
    setCurrentPlaybackTimes((prev) => ({
      ...prev,
      [recordingId]: timeInSeconds,
    }));

    // Start playback
    if (playing !== recordingId) {
      setPlaying(recordingId);
    }

    // Find the audio element and seek
    const audio = document.getElementById('meeting-audio-player') as HTMLAudioElement;
    if (audio) {
      audio.currentTime = timeInSeconds;
      audio.play().catch((e) => {
        console.error('Error playing audio:', e);
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FilePlus className="h-5 w-5" />
          Recordings
        </CardTitle>
        <CardDescription>
          Audio recordings associated with this meeting
          {isGeneratingTranscriptions && (
            <span className="ml-2 inline-block animate-pulse text-blue-500">
              Generating transcripts...
            </span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : recordings.length === 0 ? (
          <Alert>
            <AlertDescription>No recordings have been added to this meeting yet.</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3">
            {recordings.map((recording) => (
              <div key={recording.id} className="flex flex-col">
                {/* Clickable header */}
                <div
                  className={cn(
                    'bg-card hover:bg-accent/50 flex cursor-pointer items-center justify-between rounded-md border p-3 transition-colors',
                    expandedRecordings[recording.id] && 'rounded-b-none'
                  )}
                  onClick={() => toggleExpand(recording.id)}
                >
                  <div className="flex items-center gap-2">
                    {/* <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={(e) => togglePlay(e, recording.id)}
                      aria-label={playing === recording.id ? 'Pause' : 'Play'}
                    >
                      {playing === recording.id ? (
                        <Pause className="text-primary h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button> */}

                    <div>
                      <p className="font-medium">
                        {recording.recordingName || 'Unnamed Recording'}
                      </p>
                      <div className="text-muted-foreground flex items-center gap-2 text-sm">
                        <span>{formatDuration(recording.duration, recording.durationSeconds)}</span>
                        <span>•</span>
                        <span>
                          {formatDistanceToNow(new Date(recording.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDownload(e, recording.id)}
                      className="h-8 w-8"
                    >
                      <Download className="h-4 w-4" />
                    </Button>

                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => confirmDelete(e, recording.id)}
                        className="h-8 w-8"
                      >
                        <Trash2 className="text-destructive h-4 w-4" />
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(recording.id);
                      }}
                      className="h-8 w-8"
                    >
                      {expandedRecordings[recording.id] ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Animated content section */}
                <AnimatePresence>
                  {expandedRecordings[recording.id] && recordingURLs[recording.id] && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden rounded-b-md border border-t-0"
                    >
                      <div className="p-3">
                        {recording.transcription ? (
                          <Tabs
                            value={activeTab[recording.id] || 'audio'}
                            onValueChange={(value) =>
                              setActiveTab((prev) => ({
                                ...prev,
                                [recording.id]: value,
                              }))
                            }
                            className="w-full"
                          >
                            <TabsList className="mb-2">
                              <TabsTrigger value="audio">Audio</TabsTrigger>
                              <TabsTrigger value="transcript">Transcript</TabsTrigger>
                            </TabsList>

                            <TabsContent value="audio" className="mt-0">
                              <AudioPlayer
                                src={recordingURLs[recording.id]}
                                isPlaying={playing === recording.id}
                                onPlayPause={() =>
                                  togglePlay(new MouseEvent('click') as any, recording.id)
                                }
                                totalDurationSeconds={getDurationInSeconds(
                                  recording.duration,
                                  recording.durationSeconds
                                )}
                                initialTime={currentPlaybackTimes[recording.id] || 0}
                                onTimeUpdate={(time) => handleTimeUpdate(recording.id, time)}
                              />
                            </TabsContent>

                            <TabsContent value="transcript" className="mt-0">
                              <RecordingTranscript
                                meetingId={meetingId}
                                transcription={recording.transcription}
                                audioUrl={recordingURLs[recording.id] || null}
                                currentPlaybackTime={currentPlaybackTimes[recording.id] || 0}
                                onPlaySegment={(timeInSeconds) =>
                                  handlePlaySegment(recording.id, timeInSeconds)
                                }
                              />
                            </TabsContent>
                          </Tabs>
                        ) : (
                          /* Just the audio player if no transcription */
                          <AudioPlayer
                            src={recordingURLs[recording.id]}
                            isPlaying={playing === recording.id}
                            onPlayPause={() =>
                              togglePlay(new MouseEvent('click') as any, recording.id)
                            }
                            totalDurationSeconds={getDurationInSeconds(
                              recording.duration,
                              recording.durationSeconds
                            )}
                            initialTime={currentPlaybackTimes[recording.id] || 0}
                            onTimeUpdate={(time) => handleTimeUpdate(recording.id, time)}
                          />
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
              This will permanently delete this recording from the meeting. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
