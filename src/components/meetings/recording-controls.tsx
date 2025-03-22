'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, Pause, Square, X, ListPlus, FileAudio, Play, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useWorkspaceMeetings, useCreateMeeting } from '@/lib/hooks/use-queries';
import { getRecordingUploadUrl, addMeetingRecording } from '@/lib/actions/meeting-recordings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { useDraftRecordings, DraftRecording } from '@/contexts/draft-recordings-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '../ui/badge';
import { useQueryClient } from '@tanstack/react-query';
import { ScrollArea } from '@/components/ui/scroll-area';

interface RecordingControlsProps {
  workspaceId: string;
  defaultSelectedMeetingId?: string;
  workspaceName?: string;
  onRecordingSaved?: () => void;
  onDraftAdded?: () => void;
  onRecordingDeleted?: () => void;
}

type Meeting = {
  id: string;
  title: string;
  createdAt: string;
  description?: string | null;
};

// AudioVisualization Component
function AudioVisualization({ audioLevel }: { audioLevel: number }) {
  return (
    <div className="mb-4 flex w-full justify-center">
      <div className="h-4 w-full max-w-[240px]">
        <motion.div
          className="h-1 rounded-full bg-red-500"
          style={{
            scaleY: audioLevel * 4,
            originY: 1,
          }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 15,
          }}
        />
      </div>
    </div>
  );
}

// RecordingTimer Component
function RecordingTimer({
  seconds,
  status,
}: {
  seconds: number;
  status: 'recording' | 'paused' | 'complete';
}) {
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="mb-4 text-center">
      <p className="font-mono text-2xl font-medium">{formatTime(seconds)}</p>
      <p className="text-muted-foreground text-sm">
        {status === 'recording'
          ? 'Recording...'
          : status === 'paused'
            ? 'Recording paused'
            : 'Recording complete'}
      </p>
    </div>
  );
}

// RecordButton Component
function RecordButton({
  isRecording,
  isPaused,
  onStart,
  onPause,
  onResume,
}: {
  isRecording: boolean;
  isPaused: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
}) {
  if (isRecording) {
    if (isPaused) {
      return (
        <Button
          size="icon"
          className="h-auto flex-1 rounded-xl bg-emerald-500 shadow-md hover:bg-emerald-600"
          onClick={onResume}
        >
          <Mic className="h-7 w-7 text-white" />
        </Button>
      );
    } else {
      return (
        <Button
          size="icon"
          className="h-auto flex-1 rounded-xl bg-yellow-500 shadow-md hover:bg-yellow-600"
          onClick={onPause}
        >
          <Pause className="h-7 w-7 text-white" />
        </Button>
      );
    }
  } else {
    return (
      <Button
        size="icon"
        className="h-auto flex-1 rounded-xl bg-red-500 shadow-md hover:bg-red-600"
        onClick={onStart}
      >
        <Mic className="h-7 w-7 text-white" />
      </Button>
    );
  }
}

// UploadProgress Component
function UploadProgress({
  isUploading,
  progress,
  error,
}: {
  isUploading: boolean;
  progress: number;
  error: string | null;
}) {
  if (isUploading) {
    return (
      <div className="mt-4 w-full">
        <Progress value={progress} className="h-2" />
        <p className="text-muted-foreground mt-2 text-center text-sm">
          Uploading recording... {progress}%
        </p>
      </div>
    );
  }

  if (error) {
    return <p className="text-destructive mt-4 text-center text-sm">{error}</p>;
  }

  return null;
}

// SaveRecordingDialog Component
function SaveRecordingDialog({
  open,
  onOpenChange,
  isUploading,
  recordingName,
  setRecordingName,
  onShowNewMeetingDialog,
  meetings,
  isFetchingMeetings,
  selectedMeetingId,
  setSelectedMeetingId,
  selectedMeeting,
  recordingTime,
  onSave,
  onUseLater,
  formatTime,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isUploading: boolean;
  recordingName: string;
  setRecordingName: (name: string) => void;
  onShowNewMeetingDialog: () => void;
  meetings: Meeting[];
  isFetchingMeetings: boolean;
  selectedMeetingId: string | null;
  setSelectedMeetingId: (id: string) => void;
  selectedMeeting: Meeting | undefined;
  recordingTime: number;
  onSave: () => void;
  onUseLater: () => void;
  formatTime: (seconds: number) => string;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open && !isUploading) {
          onOpenChange(open);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save Recording</DialogTitle>
          <DialogDescription>
            This recording has been saved as a draft. You can add it to a meeting now or later.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Recording Name</Label>
            <Input
              value={recordingName}
              onChange={(e) => setRecordingName(e.target.value)}
              placeholder="Enter recording name"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Select Meeting</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={onShowNewMeetingDialog}
              >
                <ListPlus className="mr-1 h-3 w-3" />
                New Meeting
              </Button>
            </div>

            <Select
              value={selectedMeetingId || ''}
              onValueChange={(value) => setSelectedMeetingId(value)}
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

            {selectedMeeting && (
              <p className="text-muted-foreground text-xs">
                Created{' '}
                {formatDistanceToNow(new Date(selectedMeeting.createdAt), {
                  addSuffix: true,
                })}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-primary flex h-6 w-6 items-center justify-center rounded-full">
              <Square className="text-primary-foreground h-3 w-3" />
            </div>
            <div>
              <p className="text-sm font-medium">{formatTime(recordingTime)}</p>
              <p className="text-muted-foreground text-xs">Recording length</p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onUseLater} disabled={isUploading}>
            Use Later
          </Button>
          <Button onClick={onSave} disabled={!selectedMeeting || isUploading}>
            {isUploading ? `Uploading...` : 'Save Recording'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// DraftItem Component
function DraftItem({
  draft,
  isPlaying,
  onTogglePlay,
  onAddToMeeting,
  onDelete,
  formatTime,
}: {
  draft: DraftRecording;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onAddToMeeting: () => void;
  onDelete: () => void;
  formatTime: (seconds: number) => string;
}) {
  return (
    <div className="hover:bg-accent/50 group flex flex-col rounded-md border p-3 transition-colors">
      <div className="flex items-center gap-3">
        <motion.div
          whileTap={{ scale: 0.9 }}
          className={`flex h-10 w-10 items-center justify-center rounded-full ${isPlaying ? 'bg-primary text-primary-foreground' : 'bg-muted/50 hover:bg-primary/10'} transition-colors`}
        >
          <Button variant="ghost" size="icon" onClick={onTogglePlay} className="h-8 w-8 p-0">
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
        </motion.div>

        <div className="overflow-hidden">
          <p className="truncate font-medium" title={draft.name}>
            {draft.name}
          </p>
          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline" className="px-1 py-0 text-xs font-normal">
              {formatTime(draft.duration)}
            </Badge>
            <span className="xs:inline hidden">•</span>
            <span>
              {formatDistanceToNow(new Date(draft.createdAt), {
                addSuffix: true,
              })}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={onAddToMeeting}>
          <ListPlus className="mr-1 h-4 w-4" />
          <span>Add to Meeting</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="mr-1 h-4 w-4" />
          <span>Delete</span>
        </Button>
      </div>
    </div>
  );
}

// Main component
export function RecordingControls({
  workspaceId,
  defaultSelectedMeetingId,
  onRecordingSaved,
  onDraftAdded,
  onRecordingDeleted,
}: RecordingControlsProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingStatus, setRecordingStatus] = useState<'recording' | 'paused' | 'complete'>(
    'recording'
  );
  const [recordingName, setRecordingName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [existingMeetings, setExistingMeetings] = useState<Meeting[]>([]);
  const [showSavingDialog, setShowSavingDialog] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(
    defaultSelectedMeetingId || null
  );
  const [showMeetingCreateDialog, setShowMeetingCreateDialog] = useState(false);
  const [newMeetingTitle, setNewMeetingTitle] = useState('');
  const [newMeetingDescription, setNewMeetingDescription] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [activeTab, setActiveTab] = useState('recorder');
  const [playing, setPlaying] = useState<string | null>(null);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [selectedDraft, setSelectedDraft] = useState<DraftRecording | null>(null);
  const [isAddingToMeeting, setIsAddingToMeeting] = useState(false);
  const [draftRecordingName, setDraftRecordingName] = useState('');
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [recordingToDelete, setRecordingToDelete] = useState<string | null>(null);
  const [showDraftDeleteConfirmDialog, setShowDraftDeleteConfirmDialog] = useState(false);
  const [draftToDelete, setDraftToDelete] = useState<string | null>(null);

  const { draftRecordings, addDraftRecording, deleteDraftRecording } = useDraftRecordings();

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioDataRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Use React Query to load meetings
  const { data: fetchedMeetings = [], isLoading: isFetchingMeetings } = useWorkspaceMeetings(
    workspaceId && (showSavingDialog || isAddingToMeeting) ? workspaceId : ''
  );

  // Create meeting mutation
  const { mutateAsync: createMeetingMutation } = useCreateMeeting();

  const selectedMeeting = useMemo(() => {
    return existingMeetings.find((meeting) => meeting.id === selectedMeetingId);
  }, [existingMeetings, selectedMeetingId]);

  // Map server data to client format
  useEffect(() => {
    if (fetchedMeetings.length > 0) {
      const formattedMeetings: Meeting[] = fetchedMeetings.map((meeting) => ({
        id: meeting.id,
        title: meeting.title,
        description: meeting.description,
        createdAt: meeting.createdAt.toISOString(),
      }));
      setExistingMeetings(formattedMeetings);
    }
  }, [fetchedMeetings]);

  // Handle playing draft audio
  useEffect(() => {
    if (playing) {
      const draft = draftRecordings.find((r) => r.id === playing);
      if (draft) {
        const audioUrl = URL.createObjectURL(draft.blob);
        const newAudio = new Audio(audioUrl);
        newAudio.onended = () => setPlaying(null);
        newAudio.play();
        setAudio(newAudio);

        return () => {
          newAudio.pause();
          URL.revokeObjectURL(audioUrl);
        };
      }
    } else if (audio) {
      audio.pause();
      setAudio(null);
    }
  }, [playing, draftRecordings]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const updateAudioLevel = () => {
    if (!audioAnalyserRef.current || !audioDataRef.current) return;

    audioAnalyserRef.current.getByteFrequencyData(audioDataRef.current);
    const average = audioDataRef.current.reduce((a, b) => a + b, 0) / audioDataRef.current.length;
    const normalizedValue = Math.min(average / 128, 1);
    setAudioLevel(normalizedValue);

    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  };

  const resetRecordingState = () => {
    setRecordingTime(0);
    setIsRecording(false);
    setIsPaused(false);
    setRecordingStatus('recording');
    audioChunksRef.current = [];
    audioBlobRef.current = null;
    setUploadError(null);
  };

  const startRecording = async () => {
    try {
      // Reset state before starting a new recording
      resetRecordingState();

      setRecordingName(`Recording ${new Date().toLocaleTimeString()}`);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      // Set up audio analysis for visualization
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;

      audioAnalyserRef.current = analyser;
      audioDataRef.current = new Uint8Array(analyser.frequencyBinCount);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingStatus('recording');
      startTimer();

      // Start visualizing audio levels
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);

      toast.success('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording', {
        description: 'Please check your microphone permissions.',
      });
    }
  };

  const pauseRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;

    mediaRecorderRef.current.pause();
    setIsPaused(true);
    setRecordingStatus('paused');
    stopTimer();

    // Stop visualizing audio levels
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    toast('Recording paused');
  };

  const resumeRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'paused') return;

    mediaRecorderRef.current.resume();
    setIsPaused(false);
    setRecordingStatus('recording');
    startTimer();

    // Resume visualizing audio levels
    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);

    toast('Recording resumed');
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current) return;

    return new Promise<void>((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve();
        return;
      }

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: 'audio/mp3',
        });

        // Save blob for later use
        audioBlobRef.current = audioBlob;

        stopTimer();
        setIsRecording(false);
        setIsPaused(false);
        setRecordingStatus('complete');

        // Stop visualizing audio levels
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }

        // Add to draft recordings automatically with duration in seconds
        if (addDraftRecording) {
          // Store both formatted duration and raw seconds
          addDraftRecording(audioBlob, recordingTime, formatTime(recordingTime));
          toast.success('Recording saved as draft');
        }

        // Show saving dialog
        setShowSavingDialog(true);

        resolve();
      };

      mediaRecorderRef.current.stop();

      // Stop all tracks in the stream
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    });
  };

  const cancelRecording = async () => {
    if (mediaRecorderRef.current) {
      // Stop visualizing audio levels
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Stop the MediaRecorder without processing the recording
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current = null;
    }

    resetRecordingState();
    toast.info('Recording discarded');
  };

  const createNewMeeting = async () => {
    if (!newMeetingTitle.trim()) {
      toast.error('Please enter a meeting title');
      return;
    }

    try {
      const newMeeting = await createMeetingMutation({
        workspaceId: workspaceId,
        title: newMeetingTitle,
        description: newMeetingDescription,
        startTime: new Date(),
      });

      const formattedMeeting: Meeting = {
        id: newMeeting.id,
        title: newMeeting.title,
        description: newMeeting.description,
        createdAt: newMeeting.createdAt.toISOString(),
      };

      setSelectedMeetingId(formattedMeeting.id);
      setShowMeetingCreateDialog(false);

      // Reset form
      setNewMeetingTitle('');
      setNewMeetingDescription('');
    } catch (error) {
      console.error('Error creating meeting:', error);
    }
  };

  const saveRecording = async () => {
    if (!audioBlobRef.current) {
      toast.error('No recording to save');
      return;
    }

    // Check if we have a meeting to save to
    if (!selectedMeetingId || !selectedMeeting) {
      toast.error('Please select a meeting');
      return;
    }

    setShowSavingDialog(false);

    try {
      setIsUploading(true);
      setUploadError(null);

      // Get upload URL
      const { uploadUrl, fileKey } = await getRecordingUploadUrl({
        meetingId: selectedMeetingId,
        fileName: `recording-${Date.now()}.mp3`,
        contentType: 'audio/mp3',
      });

      // Upload the recording
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl, true);
      xhr.setRequestHeader('Content-Type', 'audio/mp3');

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percentComplete);
        }
      };

      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            // Add recording to the meeting
            await addMeetingRecording({
              meetingId: selectedMeetingId,
              fileKey,
              recordingName: recordingName,
              duration: formatTime(recordingTime),
              durationSeconds: recordingTime.toString(), // Add the raw seconds value
              addCurrentUserAsParticipant: true, // Add flag to ensure current user is added as participant
            });

            // Invalidate the recordings query to refresh the list
            queryClient.invalidateQueries({
              queryKey: ['recordings', selectedMeetingId],
            });

            // Call the callback after successful save
            onRecordingSaved?.();

            toast.success('Recording saved');

            // Find the draft that was just uploaded
            const lastDraft = draftRecordings[draftRecordings.length - 1];
            if (lastDraft) {
              setRecordingToDelete(lastDraft.id);
              setShowDeleteConfirmDialog(true);
            }

            setIsUploading(false);
            setUploadProgress(0);
            resetRecordingState();
            audioBlobRef.current = null;
            setSelectedMeetingId(null);
            setRecordingName('');

            // Navigate to the meeting page
            router.push(`/workspace/${workspaceId}/meeting/${selectedMeetingId}`);
            router.refresh();
          } catch (error) {
            console.error('Error saving recording:', error);
            setUploadError('Failed to save recording details.');
            setIsUploading(false);
          }
        } else {
          setUploadError(`Upload failed (${xhr.status})`);
          setIsUploading(false);
        }
      };

      xhr.onerror = () => {
        setUploadError('Network error occurred during upload.');
        setIsUploading(false);
      };

      xhr.ontimeout = () => {
        setUploadError('Upload timed out.');
        setIsUploading(false);
      };

      xhr.send(audioBlobRef.current);
    } catch (error) {
      let errorMessage = 'An error occurred while saving your recording.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      setUploadError(errorMessage);
      setIsUploading(false);
    }
  };

  // Toggle play/pause for a draft recording
  const togglePlay = (id: string) => {
    if (playing === id) {
      setPlaying(null);
    } else {
      if (playing) {
        // Stop any currently playing audio first
        setPlaying(null);
        setTimeout(() => setPlaying(id), 50);
      } else {
        setPlaying(id);
      }
    }
  };

  // Add a draft recording to a meeting
  const addDraftToMeeting = async () => {
    if (!selectedDraft || !selectedMeetingId) return;

    try {
      setIsAddingToMeeting(false);
      toast.loading('Adding recording to meeting...');

      // Generate a filename
      const filename = `recording-${Date.now()}.mp3`;

      // Get a signed upload URL
      const { uploadUrl, fileKey } = await getRecordingUploadUrl({
        meetingId: selectedMeetingId,
        fileName: filename,
        contentType: selectedDraft.blob.type,
      });

      // Upload the file
      await fetch(uploadUrl, {
        method: 'PUT',
        body: selectedDraft.blob,
        headers: {
          'Content-Type': selectedDraft.blob.type,
        },
      });

      // Add the recording to the meeting
      await addMeetingRecording({
        meetingId: selectedMeetingId,
        fileKey,
        recordingName: draftRecordingName,
        duration: selectedDraft.formattedDuration || formatTime(selectedDraft.duration),
        durationSeconds: selectedDraft.duration.toString(),
        addCurrentUserAsParticipant: true, // Add flag to ensure current user is added as participant
      });

      // Invalidate the recordings query to refresh the list
      queryClient.invalidateQueries({
        queryKey: ['recordings', selectedMeetingId],
      });

      // Call the callback after successful addition
      onRecordingSaved?.();

      // Ask if the user wants to delete the draft
      setRecordingToDelete(selectedDraft.id);
      setShowDeleteConfirmDialog(true);

      toast.dismiss();
      toast.success('Recording added to meeting');

      // Navigate to the meeting
      router.push(`/workspace/${workspaceId}/meeting/${selectedMeetingId}`);
      router.refresh();
    } catch (error) {
      console.error('Failed to add recording to meeting:', error);
      toast.dismiss();
      toast.error('Failed to add recording to meeting');
    }
  };

  const handleDraftDelete = (id: string) => {
    setDraftToDelete(id);
    setShowDraftDeleteConfirmDialog(true);
  };

  const confirmDraftDeletion = () => {
    if (draftToDelete) {
      try {
        deleteDraftRecording(draftToDelete);
        if (playing === draftToDelete) {
          setPlaying(null);
        }
        // Call the callback after successful deletion
        onRecordingDeleted?.();
        toast.success('Draft recording deleted');
      } catch (error) {
        console.error('Failed to delete draft recording:', error);
        toast.error('Failed to delete recording');
      }
      setShowDraftDeleteConfirmDialog(false);
      setDraftToDelete(null);
    }
  };

  const handleUseLater = () => {
    setShowSavingDialog(false);
    setActiveTab('drafts');
    resetRecordingState();
    toast.info('Recording saved as draft. Access it from the Drafts tab.');
  };

  return (
    <>
      {/* Save Recording Dialog */}
      <SaveRecordingDialog
        open={showSavingDialog}
        onOpenChange={setShowSavingDialog}
        isUploading={isUploading}
        recordingName={recordingName}
        setRecordingName={setRecordingName}
        onShowNewMeetingDialog={() => setShowMeetingCreateDialog(true)}
        meetings={existingMeetings}
        isFetchingMeetings={isFetchingMeetings}
        selectedMeetingId={selectedMeetingId}
        setSelectedMeetingId={setSelectedMeetingId}
        selectedMeeting={selectedMeeting}
        recordingTime={recordingTime}
        onSave={saveRecording}
        onUseLater={handleUseLater}
        formatTime={formatTime}
      />

      {/* Create New Meeting Dialog */}
      <Dialog open={showMeetingCreateDialog} onOpenChange={setShowMeetingCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Meeting</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="meeting-title">Meeting Title</Label>
              <Input
                id="meeting-title"
                value={newMeetingTitle}
                onChange={(e) => setNewMeetingTitle(e.target.value)}
                placeholder="Enter meeting title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meeting-description">Description (Optional)</Label>
              <Textarea
                id="meeting-description"
                value={newMeetingDescription}
                onChange={(e) => setNewMeetingDescription(e.target.value)}
                placeholder="Enter meeting description"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMeetingCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createNewMeeting}>Create Meeting</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Draft to Meeting Dialog */}
      <Dialog open={isAddingToMeeting} onOpenChange={setIsAddingToMeeting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Recording to Meeting</DialogTitle>
            <DialogDescription>Choose a meeting to add this recording to.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="recording-name">Recording Name</Label>
              <Input
                id="recording-name"
                value={draftRecordingName}
                onChange={(e) => setDraftRecordingName(e.target.value)}
                placeholder="Enter a name for this recording"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Select Meeting</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => {
                    setIsAddingToMeeting(false);
                    setShowMeetingCreateDialog(true);
                  }}
                >
                  <ListPlus className="mr-1 h-3 w-3" />
                  New Meeting
                </Button>
              </div>

              <Select
                value={selectedMeetingId || ''}
                onValueChange={(value) => setSelectedMeetingId(value)}
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
                  ) : existingMeetings.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No meetings found
                    </SelectItem>
                  ) : (
                    existingMeetings.map((meeting) => (
                      <SelectItem key={meeting.id} value={meeting.id}>
                        {meeting.title}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingToMeeting(false)}>
              Cancel
            </Button>
            <Button
              onClick={addDraftToMeeting}
              disabled={!selectedMeeting || !draftRecordingName.trim()}
            >
              Add to Meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Draft Recording?</DialogTitle>
            <DialogDescription>
              Your recording has been successfully added to the meeting. Would you like to delete
              the draft version?
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <p className="text-sm">
                <strong>Note:</strong> Keeping the draft will allow you to add this recording to
                other meetings in the future. Draft recordings are stored locally in your browser
                and will be lost if you clear your browser data.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteConfirmDialog(false);
                setRecordingToDelete(null);
              }}
            >
              Keep Draft
            </Button>
            <Button
              variant="default"
              onClick={() => {
                if (recordingToDelete) {
                  deleteDraftRecording(recordingToDelete);
                  toast.success('Draft recording deleted');
                }
                setShowDeleteConfirmDialog(false);
                setRecordingToDelete(null);
              }}
            >
              Delete Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Draft Delete Confirmation Dialog */}
      <Dialog open={showDraftDeleteConfirmDialog} onOpenChange={setShowDraftDeleteConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Draft Recording?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this draft recording? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDraftDeleteConfirmDialog(false);
                setDraftToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDraftDeletion}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="w-full gap-2 overflow-hidden p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="text-sm font-medium">
            {activeTab === 'recorder' ? 'Audio Recorder' : 'Draft Recordings'}
          </div>
        </motion.div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="recorder" className="flex-1">
              <Mic className="mr-2 h-4 w-4" />
              Recorder
            </TabsTrigger>
            <TabsTrigger value="drafts" className="flex-1">
              <FileAudio className="mr-2 h-4 w-4" />
              Drafts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recorder">
            {/* Audio Visualization */}
            {isRecording && <AudioVisualization audioLevel={audioLevel} />}

            {/* Timer */}
            {(isRecording || recordingTime > 0) && (
              <RecordingTimer
                seconds={recordingTime}
                status={isRecording ? (isPaused ? 'paused' : 'recording') : 'complete'}
              />
            )}

            {/* Controls */}
            <div className="flex h-20 gap-4">
              {isRecording && (
                <Button
                  size="icon"
                  variant="outline"
                  className="h-auto flex-1 rounded-xl border-2 shadow-sm"
                  onClick={cancelRecording}
                >
                  <X className="h-5 w-5" />
                </Button>
              )}

              <RecordButton
                isRecording={isRecording}
                isPaused={isPaused}
                onStart={startRecording}
                onPause={pauseRecording}
                onResume={resumeRecording}
              />

              {isRecording && (
                <Button
                  size="icon"
                  variant="outline"
                  className="h-auto flex-1 rounded-xl border-2 shadow-sm"
                  onClick={stopRecording}
                >
                  <Square className="h-5 w-5" />
                </Button>
              )}
            </div>

            {/* Upload Progress */}
            <UploadProgress
              isUploading={isUploading}
              progress={uploadProgress}
              error={uploadError}
            />
          </TabsContent>

          <TabsContent value="drafts">
            {draftRecordings.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center justify-center py-10 text-center"
              >
                <div className="bg-muted/30 mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                  <FileAudio className="text-muted-foreground h-8 w-8" />
                </div>
                <h3 className="font-medium">No draft recordings</h3>
                <p className="text-muted-foreground mt-1 max-w-xs text-sm">
                  Recordings you create will be saved as drafts automatically
                </p>
                <Button variant="outline" className="mt-4" onClick={() => setActiveTab('recorder')}>
                  <Mic className="mr-2 h-4 w-4" />
                  Start Recording
                </Button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="space-y-3"
              >
                <div className="bg-muted/50 text-muted-foreground mb-2 rounded-md p-3 text-xs">
                  <p>
                    <strong>Note:</strong> Draft recordings are stored locally in your browser.
                    Clearing your browser data or using another device will mean you cannot access
                    these recordings.
                  </p>
                </div>

                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-3">
                    {/* Sort the draft recordings by creation time, newest first */}
                    {[...draftRecordings]
                      .sort(
                        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                      )
                      .map((draft, index) => (
                        <motion.div
                          key={draft.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.3,
                            delay: index * 0.05,
                            ease: 'easeOut',
                          }}
                          className="relative overflow-hidden"
                        >
                          <DraftItem
                            draft={draft}
                            isPlaying={playing === draft.id}
                            onTogglePlay={() => togglePlay(draft.id)}
                            onAddToMeeting={() => {
                              setSelectedDraft(draft);
                              setDraftRecordingName(draft.name);
                              setIsAddingToMeeting(true);
                            }}
                            onDelete={() => handleDraftDelete(draft.id)}
                            formatTime={formatTime}
                          />

                          {playing === draft.id && (
                            <motion.div
                              initial={{ scaleX: 0 }}
                              animate={{ scaleX: 1 }}
                              exit={{ scaleX: 0 }}
                              transition={{ duration: audio?.duration || 30 }}
                              className="bg-primary absolute bottom-0 left-0 h-[2px] w-full origin-left"
                            />
                          )}
                        </motion.div>
                      ))}
                  </div>
                </ScrollArea>
              </motion.div>
            )}
          </TabsContent>
        </Tabs>
      </Card>
    </>
  );
}
