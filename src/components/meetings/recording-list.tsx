'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Trash2,
  Download,
  FilePlus,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  MoreVertical,
} from 'lucide-react';
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
  useRegenerateRecordingTranscription,
} from '@/lib/hooks/use-queries';
import RecordingTranscript from './recording-transcript';
import TranscriptEditor from './transcript-editor';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  transcriptionGeneratedAt?: Date | null; // Add this field
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
  const { mutate: regenerateTranscription, isPending: isRegeneratingTranscription } =
    useRegenerateRecordingTranscription(meetingId);

  // Sort recordings by creation date (newest first)
  const sortedRecordings = [...recordings].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const [playing, setPlaying] = useState<string | null>(null);
  const [recordingURLs, setRecordingURLs] = useState<Record<string, string>>({});
  const [expandedRecordings, setExpandedRecordings] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<Record<string, string>>({});
  const [recordingToDelete, setRecordingToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPlaybackTimes, setCurrentPlaybackTimes] = useState<Record<string, number>>({});
  const [loadingRecordings, setLoadingRecordings] = useState<Record<string, boolean>>({});
  const [regeneratingIds, setRegeneratingIds] = useState<Record<string, boolean>>({});
  const [regenerateAllDialogOpen, setRegenerateAllDialogOpen] = useState(false);
  const [editingTranscript, setEditingTranscript] = useState<string | null>(null);
  const [editingSegmentIndex, setEditingSegmentIndex] = useState<number | undefined>(undefined);

  // Add an effect to refresh recordings when the component mounts or when recordings change
  useEffect(() => {
    // Invalidate and refetch recordings
    queryClient.invalidateQueries({ queryKey: ['recordings', meetingId] });

    // Check for recordings without transcriptions and generate them
    generateTranscriptions(false);
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
          const downloadUrl = await getDownloadUrl(recordingId);

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
        downloadUrl = await getDownloadUrl(recordingId);

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
        // Set loading state for this recording
        setLoadingRecordings((prev) => ({
          ...prev,
          [recordingId]: true,
        }));

        const downloadUrl = await getDownloadUrl(recordingId);
        setRecordingURLs((prev) => ({
          ...prev,
          [recordingId]: downloadUrl,
        }));

        // Clear loading state
        setLoadingRecordings((prev) => ({
          ...prev,
          [recordingId]: false,
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
      // Clear loading state in case of error
      setLoadingRecordings((prev) => ({
        ...prev,
        [recordingId]: false,
      }));

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
        .then((downloadUrl) => {
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

  // Handle regenerating transcription for a single recording
  const handleRegenerateTranscription = (e: React.MouseEvent, recordingId: string) => {
    e.stopPropagation();

    // Set loading state for this recording
    setRegeneratingIds((prev) => ({
      ...prev,
      [recordingId]: true,
    }));

    // Call the mutation
    regenerateTranscription(recordingId, {
      onSuccess: () => {
        setRegeneratingIds((prev) => ({
          ...prev,
          [recordingId]: false,
        }));

        // Make sure this recording is expanded and showing the transcript tab
        setExpandedRecordings((prev) => ({
          ...prev,
          [recordingId]: true,
        }));
        setActiveTab((prev) => ({
          ...prev,
          [recordingId]: 'transcript',
        }));
      },
      onError: () => {
        setRegeneratingIds((prev) => ({
          ...prev,
          [recordingId]: false,
        }));
      },
    });
  };

  // Handle regenerating all transcriptions
  const handleRegenerateAllTranscriptions = () => {
    setRegenerateAllDialogOpen(false);

    // Call generate with force flag set to true
    generateTranscriptions(true);
  };

  // Create content items for TabsContent value="transcript"
  const renderTranscriptContent = (recording: Recording) => {
    // If we're currently editing this recording's transcript
    if (editingTranscript === recording.id) {
      return (
        <TranscriptEditor
          meetingId={meetingId}
          recordingId={recording.id}
          transcription={recording.transcription || null}
          onClose={() => {
            setEditingTranscript(null);
            setEditingSegmentIndex(undefined);
          }}
          highlightedSegmentIndex={editingSegmentIndex}
        />
      );
    }

    return (
      <>
        <div className="flex items-center justify-between">
          {recording.transcriptionGeneratedAt && (
            <div className="text-muted-foreground mb-2 text-xs">
              Transcript generated{' '}
              {formatDistanceToNow(new Date(recording.transcriptionGeneratedAt), {
                addSuffix: true,
              })}
            </div>
          )}

          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingTranscript(recording.id);
                setEditingSegmentIndex(undefined);
              }}
            >
              Edit Transcript
            </Button>
          )}
        </div>

        {recording.transcription ? (
          <RecordingTranscript
            meetingId={meetingId}
            transcription={recording.transcription}
            audioUrl={recordingURLs[recording.id]}
            currentPlaybackTime={currentPlaybackTimes[recording.id] || 0}
            onPlaySegment={(timeInSeconds) => handlePlaySegment(recording.id, timeInSeconds)}
            canEdit={canEdit}
            onEditSegment={(segmentIndex) => {
              setEditingTranscript(recording.id);
              setEditingSegmentIndex(segmentIndex);
            }}
          />
        ) : null}
      </>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <FilePlus className="h-5 w-5" />
            Recordings
          </CardTitle>

          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isGeneratingTranscriptions || recordings.length === 0}
                  className="h-8 w-full sm:w-auto"
                >
                  {isGeneratingTranscriptions ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Transcripts
                    </>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => generateTranscriptions(false)}
                  disabled={isGeneratingTranscriptions}
                >
                  Generate missing transcripts
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setRegenerateAllDialogOpen(true)}
                  disabled={isGeneratingTranscriptions}
                  className="text-orange-600 focus:text-orange-600"
                >
                  Regenerate all transcripts
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

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
        ) : sortedRecordings.length === 0 ? (
          <Alert>
            <AlertDescription>No recordings have been added to this meeting yet.</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3">
            {sortedRecordings.map((recording) => (
              <div key={recording.id} className="flex flex-col">
                {/* Clickable header */}
                <div
                  className={cn(
                    'bg-card hover:bg-accent/50 flex cursor-pointer items-center justify-between rounded-md border p-2 transition-colors',
                    expandedRecordings[recording.id] && 'rounded-b-none'
                  )}
                  onClick={() => toggleExpand(recording.id)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {recording.recordingName || 'Unnamed Recording'}
                    </p>
                    <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs sm:text-sm">
                      <span>{formatDuration(recording.duration, recording.durationSeconds)}</span>
                      <span className="xs:inline hidden">•</span>
                      <span className="truncate">
                        {formatDistanceToNow(new Date(recording.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                      {recording.transcriptionGeneratedAt && (
                        <>
                          <span className="xs:inline hidden">•</span>
                          <span className="flex items-center gap-1 text-xs">
                            <RefreshCw className="h-3 w-3" />
                            <span className="hidden sm:inline">Transcript </span>
                            {formatDistanceToNow(new Date(recording.transcriptionGeneratedAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="ml-2 flex shrink-0 items-center gap-1">
                    {/* Mobile view menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild className="sm:hidden">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(e, recording.id);
                          }}
                        >
                          <Download className="mr-2 h-4 w-4" /> Download
                        </DropdownMenuItem>
                        {canEdit && (
                          <>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRegenerateTranscription(e, recording.id);
                              }}
                              disabled={regeneratingIds[recording.id]}
                            >
                              <RefreshCw
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  regeneratingIds[recording.id] && 'animate-spin'
                                )}
                              />
                              Regenerate
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                confirmDelete(e, recording.id);
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Desktop view buttons */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDownload(e, recording.id)}
                      className="hidden h-8 w-8 sm:flex"
                      title="Download recording"
                    >
                      <Download className="h-4 w-4" />
                    </Button>

                    {canEdit && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => handleRegenerateTranscription(e, recording.id)}
                          className="hidden h-8 w-8 sm:flex"
                          disabled={regeneratingIds[recording.id]}
                          title="Regenerate transcript"
                        >
                          <RefreshCw
                            className={cn(
                              'h-4 w-4',
                              regeneratingIds[recording.id] && 'animate-spin'
                            )}
                          />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => confirmDelete(e, recording.id)}
                          className="hidden h-8 w-8 sm:flex"
                          title="Delete recording"
                        >
                          <Trash2 className="text-destructive h-4 w-4" />
                        </Button>
                      </>
                    )}

                    <Button
                      variant="outline"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(recording.id);
                      }}
                      className="h-8 w-8"
                      disabled={loadingRecordings[recording.id]}
                    >
                      {loadingRecordings[recording.id] ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : expandedRecordings[recording.id] ? (
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
                      <div className="p-2 sm:p-3">
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
                            <TabsList className="mb-2 grid w-full grid-cols-2">
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
                              <div className="flex flex-col space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                                  {recording.transcriptionGeneratedAt && (
                                    <div className="text-muted-foreground mb-2 text-xs">
                                      Transcript generated{' '}
                                      {formatDistanceToNow(
                                        new Date(recording.transcriptionGeneratedAt),
                                        {
                                          addSuffix: true,
                                        }
                                      )}
                                    </div>
                                  )}

                                  {canEdit && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setEditingTranscript(recording.id);
                                        setEditingSegmentIndex(undefined);
                                      }}
                                      className="mb-2 w-full sm:mb-0 sm:w-auto"
                                    >
                                      Edit Transcript
                                    </Button>
                                  )}
                                </div>

                                {editingTranscript === recording.id ? (
                                  <TranscriptEditor
                                    meetingId={meetingId}
                                    recordingId={recording.id}
                                    transcription={recording.transcription || null}
                                    onClose={() => {
                                      setEditingTranscript(null);
                                      setEditingSegmentIndex(undefined);
                                    }}
                                    highlightedSegmentIndex={editingSegmentIndex}
                                  />
                                ) : recording.transcription ? (
                                  <RecordingTranscript
                                    meetingId={meetingId}
                                    transcription={recording.transcription}
                                    audioUrl={recordingURLs[recording.id]}
                                    currentPlaybackTime={currentPlaybackTimes[recording.id] || 0}
                                    onPlaySegment={(timeInSeconds) =>
                                      handlePlaySegment(recording.id, timeInSeconds)
                                    }
                                    canEdit={canEdit}
                                    onEditSegment={(segmentIndex) => {
                                      setEditingTranscript(recording.id);
                                      setEditingSegmentIndex(segmentIndex);
                                    }}
                                  />
                                ) : null}
                              </div>
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

      {/* Regenerate all transcripts confirmation dialog */}
      <AlertDialog
        open={regenerateAllDialogOpen}
        onOpenChange={(open) => setRegenerateAllDialogOpen(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate All Transcripts</AlertDialogTitle>
            <AlertDialogDescription>
              This will regenerate transcripts for all recordings in this meeting. This process
              might take a while depending on the number and size of recordings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isGeneratingTranscriptions}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRegenerateAllTranscriptions}
              disabled={isGeneratingTranscriptions}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              {isGeneratingTranscriptions ? 'Processing...' : 'Regenerate All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
