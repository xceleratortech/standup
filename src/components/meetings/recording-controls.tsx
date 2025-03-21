'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, Pause, Square, X, ListPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useWorkspaceMeetings, useCreateMeeting } from '@/lib/hooks/use-queries';
import {
  getRecordingUploadUrl,
  addMeetingRecording,
} from '@/lib/actions/meeting-recordings';
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

interface RecordingControlsProps {
  workspaceId: string;
  workspaceName: string;
}

type Meeting = {
  id: string;
  title: string;
  createdAt: string;
  description?: string | null;
};

export default function RecordingControls({
  workspaceId,
  workspaceName,
}: RecordingControlsProps) {
  const router = useRouter();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingName, setRecordingName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [existingMeetings, setExistingMeetings] = useState<Meeting[]>([]);
  const [showSavingDialog, setShowSavingDialog] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [showMeetingCreateDialog, setShowMeetingCreateDialog] = useState(false);
  const [newMeetingTitle, setNewMeetingTitle] = useState('');
  const [newMeetingDescription, setNewMeetingDescription] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioDataRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Use React Query to load meetings
  const { data: fetchedMeetings = [] } =
    useWorkspaceMeetings(workspaceId && showSavingDialog ? workspaceId : '');

  // Create meeting mutation
  const { mutateAsync: createMeetingMutation } = useCreateMeeting();

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

  useEffect(() => {
    return () => {
      // Clean up animation frame on unmount
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Clean up timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

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

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const updateAudioLevel = () => {
    if (!audioAnalyserRef.current || !audioDataRef.current) return;

    audioAnalyserRef.current.getByteFrequencyData(audioDataRef.current);
    const average =
      audioDataRef.current.reduce((a, b) => a + b, 0) /
      audioDataRef.current.length;
    const normalizedValue = Math.min(average / 128, 1);
    setAudioLevel(normalizedValue);

    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  };

  const startRecording = async () => {
    try {
      setRecordingName(`Recording ${new Date().toLocaleTimeString()}`);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      // Set up audio analysis for visualization
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
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
      setIsPaused(false);
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
    if (
      !mediaRecorderRef.current ||
      mediaRecorderRef.current.state !== 'recording'
    )
      return;

    mediaRecorderRef.current.pause();
    setIsPaused(true);
    stopTimer();

    // Stop visualizing audio levels
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    toast('Recording paused');
  };

  const resumeRecording = () => {
    if (
      !mediaRecorderRef.current ||
      mediaRecorderRef.current.state !== 'paused'
    )
      return;

    mediaRecorderRef.current.resume();
    setIsPaused(false);
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
          type: 'audio/webm',
        });

        // Save blob for later use
        audioBlobRef.current = audioBlob;

        stopTimer();
        setIsRecording(false);
        setIsPaused(false);

        // Stop visualizing audio levels
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }

        // Show saving dialog
        setShowSavingDialog(true);

        resolve();
      };

      mediaRecorderRef.current.stop();

      // Stop all tracks in the stream
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());
    });
  };

  const cancelRecording = async () => {
    if (mediaRecorderRef.current) {
      // Stop visualizing audio levels
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Stop the MediaRecorder without processing the recording
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());
      mediaRecorderRef.current = null;
    }

    stopTimer();
    setIsRecording(false);
    setIsPaused(false);
    setRecordingTime(0);
    audioChunksRef.current = [];
    audioBlobRef.current = null;
    setUploadError(null);

    toast.info('Recording discarded');
  };

  const createNewMeeting = async () => {
    if (!newMeetingTitle.trim()) {
      toast.error('Please enter a meeting title');
      return;
    }

    try {
      const newMeeting = await createMeetingMutation({
        workspaceId,
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

      setSelectedMeeting(formattedMeeting);
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
    if (!selectedMeeting) {
      toast.error('Please select a meeting');
      return;
    }

    setMeetingId(selectedMeeting.id);
    setShowSavingDialog(false);

    try {
      setIsUploading(true);
      setUploadError(null);

      // Get upload URL
      const { uploadUrl, fileKey } = await getRecordingUploadUrl({
        meetingId: selectedMeeting.id,
        fileName: `recording-${Date.now()}.webm`,
        contentType: 'audio/webm',
      });

      // Upload the recording
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl, true);
      xhr.setRequestHeader('Content-Type', 'audio/webm');

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
              meetingId: selectedMeeting.id,
              fileKey,
              recordingName,
              duration: formatTime(recordingTime),
            });

            toast.success('Recording saved');

            setIsUploading(false);
            setUploadProgress(0);
            setRecordingTime(0);
            setUploadError(null);
            audioBlobRef.current = null;
            setSelectedMeeting(null);
            setRecordingName('');

            // Navigate to the meeting page
            router.push(
              `/workspace/${workspaceId}/meeting/${selectedMeeting.id}`
            );
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

  const discardRecording = () => {
    audioBlobRef.current = null;
    setShowSavingDialog(false);
    setSelectedMeeting(null);
    setRecordingName('');
    setRecordingTime(0);
  };

  const renderRecordButton = () => {
    if (isRecording) {
      if (isPaused) {
        return (
          <Button
            size='icon'
            className='h-14 w-14 rounded-full bg-emerald-500 hover:bg-emerald-600'
            onClick={resumeRecording}
          >
            <Mic className='h-6 w-6 text-white' />
          </Button>
        );
      } else {
        return (
          <Button
            size='icon'
            className='h-14 w-14 rounded-full bg-yellow-500 hover:bg-yellow-600'
            onClick={pauseRecording}
          >
            <Pause className='h-6 w-6 text-white' />
          </Button>
        );
      }
    } else {
      return (
        <Button
          size='icon'
          className='h-14 w-14 rounded-full bg-red-500 hover:bg-red-600'
          onClick={startRecording}
        >
          <Mic className='h-6 w-6 text-white' />
        </Button>
      );
    }
  };

  return (
    <>
      {/* Save Recording Dialog */}
      <Dialog
        open={showSavingDialog}
        onOpenChange={(open) => {
          if (!open && !isUploading) {
            discardRecording();
          }
        }}
      >
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Save Recording</DialogTitle>
          </DialogHeader>
          <div className='grid gap-4 py-4'>
            <div className='space-y-2'>
              <Label>Recording Name</Label>
              <Input
                value={recordingName}
                onChange={(e) => setRecordingName(e.target.value)}
                placeholder='Enter recording name'
              />
            </div>

            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <Label>Select Meeting</Label>
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-8 px-2 text-xs'
                  onClick={() => setShowMeetingCreateDialog(true)}
                >
                  <ListPlus className='mr-1 h-3 w-3' />
                  New Meeting
                </Button>
              </div>

              <Select
                value={selectedMeeting?.id}
                onValueChange={(value) => {
                  const meeting = existingMeetings.find((m) => m.id === value);
                  if (meeting) {
                    setSelectedMeeting(meeting);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder='Select a meeting' />
                </SelectTrigger>
                <SelectContent>
                  {existingMeetings.map((meeting) => (
                    <SelectItem key={meeting.id} value={meeting.id}>
                      {meeting.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedMeeting && (
                <p className='text-muted-foreground text-xs'>
                  Created{' '}
                  {formatDistanceToNow(new Date(selectedMeeting.createdAt), {
                    addSuffix: true,
                  })}
                </p>
              )}
            </div>

            <div className='flex items-center gap-2'>
              <div className='bg-primary flex h-6 w-6 items-center justify-center rounded-full'>
                <Square className='text-primary-foreground h-3 w-3' />
              </div>
              <div>
                <p className='text-sm font-medium'>
                  {formatTime(recordingTime)}
                </p>
                <p className='text-muted-foreground text-xs'>
                  Recording length
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={discardRecording}
              disabled={isUploading}
            >
              Discard
            </Button>
            <Button
              onClick={saveRecording}
              disabled={!selectedMeeting || isUploading}
            >
              {isUploading ? `Uploading ${uploadProgress}%` : 'Save Recording'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create New Meeting Dialog */}
      <Dialog
        open={showMeetingCreateDialog}
        onOpenChange={setShowMeetingCreateDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Meeting</DialogTitle>
          </DialogHeader>
          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label htmlFor='meeting-title'>Meeting Title</Label>
              <Input
                id='meeting-title'
                value={newMeetingTitle}
                onChange={(e) => setNewMeetingTitle(e.target.value)}
                placeholder='Enter meeting title'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='meeting-description'>
                Description (Optional)
              </Label>
              <Textarea
                id='meeting-description'
                value={newMeetingDescription}
                onChange={(e) => setNewMeetingDescription(e.target.value)}
                placeholder='Enter meeting description'
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setShowMeetingCreateDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={createNewMeeting}>Create Meeting</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main Recorder UI */}
      <div className='bg-background border-t px-4 py-4'>
        <div className='container mx-auto flex justify-center'>
          <Card className='flex w-full max-w-sm flex-col items-center p-4 sm:p-6'>
            {/* Audio Visualization */}
            {isRecording && (
              <div className='mb-4 flex w-full justify-center'>
                <div className='h-4 w-full max-w-[240px]'>
                  <motion.div
                    className='h-1 rounded-full bg-red-500'
                    style={{
                      scaleY: audioLevel * 4,
                      originY: 1,
                    }}
                    transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                  />
                </div>
              </div>
            )}

            {/* Timer */}
            {(isRecording || recordingTime > 0) && (
              <div className='mb-4 text-center'>
                <p className='font-mono text-2xl font-medium'>
                  {formatTime(recordingTime)}
                </p>
                <p className='text-muted-foreground text-sm'>
                  {isRecording
                    ? isPaused
                      ? 'Recording paused'
                      : 'Recording...'
                    : 'Recording complete'}
                </p>
              </div>
            )}

            {/* Controls */}
            <div className='flex items-center gap-4'>
              {isRecording && (
                <Button
                  size='icon'
                  variant='outline'
                  className='h-10 w-10 rounded-full'
                  onClick={cancelRecording}
                >
                  <X className='h-4 w-4' />
                </Button>
              )}

              {renderRecordButton()}

              {isRecording && !isPaused && (
                <Button
                  size='icon'
                  variant='outline'
                  className='h-10 w-10 rounded-full'
                  onClick={stopRecording}
                >
                  <Square className='h-4 w-4' />
                </Button>
              )}
            </div>

            {/* Upload Progress */}
            {isUploading && (
              <div className='mt-4 w-full'>
                <Progress value={uploadProgress} className='h-2' />
                <p className='text-muted-foreground mt-2 text-center text-sm'>
                  Uploading recording... {uploadProgress}%
                </p>
              </div>
            )}

            {/* Error Message */}
            {uploadError && (
              <p className='text-destructive mt-4 text-center text-sm'>
                {uploadError}
              </p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
