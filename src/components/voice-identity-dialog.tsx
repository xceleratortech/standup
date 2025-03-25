'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Square, Pause, Trash2, X, Plus, AlertTriangle } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { AudioPlayer } from '@/components/ui/audio-player';
import { useVoiceIdentityDownloadUrl, useVoiceIdentityOperations } from '@/lib/hooks/use-queries';
import {
  saveUserVoiceIdentity,
  deleteUserVoiceIdentity,
  deleteUserVoiceIdentitySample,
  getVoiceIdentityUploadUrl,
} from '@/lib/actions/workspace';
import { user } from '@/lib/db/auth-schema';
import { InferSelectModel } from 'drizzle-orm';
import { cn } from '@/lib/utils';
import { VariantProps } from 'class-variance-authority';
import { ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSession } from '@/lib/auth-client';
import { getVoiceSampleText } from '@/lib/config/voice-samples';
import { userVoiceIdentity } from '@/lib/db/schema';

type User = InferSelectModel<typeof user>;

interface VoiceIdentityDialogProps {
  workspaceId: string;
  hasVoiceIdentity: boolean;
  voiceIdentities?: InferSelectModel<typeof userVoiceIdentity>[];
  className?: string;
  buttonVariant?: VariantProps<typeof buttonVariants>['variant'];
  buttonClassName?: string;
  buttonLabel?: ReactNode;
}

interface VoiceSample {
  id: string;
  fileKey: string;
  sampleName: string;
  duration?: string;
  durationSeconds?: string;
  createdAt?: Date;
  audioUrl?: string;
  isPlaying?: boolean;
}

export default function VoiceIdentityDialog({
  workspaceId,
  hasVoiceIdentity,
  voiceIdentities = [],
  className,
  buttonVariant = 'ghost',
  buttonClassName,
  buttonLabel,
}: VoiceIdentityDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [recordingName, setRecordingName] = useState('');
  const [isNewRecordingMode, setIsNewRecordingMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sampleToDelete, setSampleToDelete] = useState<string | null>(null);
  const [deleteAllSamples, setDeleteAllSamples] = useState(false);
  const [voiceSamples, setVoiceSamples] = useState<VoiceSample[]>([]);
  const [maxRecordingReached, setMaxRecordingReached] = useState(false);
  const [currentSampleText, setCurrentSampleText] = useState<{
    title: string;
    text: string;
  } | null>(null);

  const { data: session } = useSession();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioDataRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const { mutateAsync: getDownloadUrl } = useVoiceIdentityDownloadUrl();
  const { invalidateVoiceIdentity } = useVoiceIdentityOperations();

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Reset recording state when dialog opens
      resetRecordingState();
      setIsNewRecordingMode(false);

      // Initialize voice samples from provided identities
      if (voiceIdentities && voiceIdentities.length > 0) {
        const samples = voiceIdentities.map((identity) => ({
          id: identity.id,
          fileKey: identity.fileKey,
          sampleName: identity.sampleName || `Voice Sample`,
          duration: identity.duration || '00:00',
          durationSeconds: identity.durationSeconds || '0',
          createdAt: identity.createdAt ? new Date(identity.createdAt) : undefined,
          isPlaying: false,
        }));
        setVoiceSamples(samples);

        // Check if we've reached the maximum number of samples
        setMaxRecordingReached(samples.length >= 3);

        // Fetch audio URLs for all samples
        samples.forEach((sample) => {
          fetchAudioUrl(sample.id, sample.fileKey);
        });

        // Set the appropriate sample text based on the next sample number
        const nextSampleNumber = samples.length + 1;
        if (nextSampleNumber <= 3) {
          setCurrentSampleText(getVoiceSampleText(nextSampleNumber));
        }
      } else {
        setVoiceSamples([]);
        setMaxRecordingReached(false);
        // Set the first sample text
        setCurrentSampleText(getVoiceSampleText(1));
      }

      setRecordingName(`Voice of ${session?.user.name || 'Me'}`);
    }
  }, [isOpen, voiceIdentities, session?.user.name]);

  // Fetch the audio URL for a sample
  const fetchAudioUrl = async (sampleId: string, fileKey: string) => {
    try {
      const { downloadUrl } = await getDownloadUrl(fileKey);
      setVoiceSamples((prev) =>
        prev.map((sample) =>
          sample.id === sampleId ? { ...sample, audioUrl: downloadUrl } : sample
        )
      );
    } catch (error) {
      console.error('Error fetching audio URL:', error);
      toast.error('Failed to load voice sample');
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setRecordingTime((prev) => {
        // Limit recording to 1 minute (60 seconds)
        if (prev >= 60) {
          stopRecording();
          return 60;
        }
        return prev + 1;
      });
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
    audioChunksRef.current = [];
    audioBlobRef.current = null;
    setUploadError(null);
  };

  const startRecording = async () => {
    try {
      // Reset state before starting a new recording
      resetRecordingState();

      // Set new recording mode to true
      setIsNewRecordingMode(true);

      // Set the sample text for this recording
      const sampleNumber = voiceSamples.length + 1;
      if (sampleNumber <= 3) {
        setCurrentSampleText(getVoiceSampleText(sampleNumber));
        setRecordingName(`Sample ${sampleNumber}: ${getVoiceSampleText(sampleNumber).title}`);
      }

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

      // Start in paused state instead of recording immediately
      setIsRecording(true);
      setIsPaused(true);
      mediaRecorderRef.current.start();

      // We don't start the timer here, it will be started when user clicks resume

      toast.success('Ready to record. Click the microphone button to start');
    } catch (error) {
      console.error('Error initializing recording:', error);
      toast.error('Failed to start recording', {
        description: 'Please check your microphone permissions.',
      });
    }
  };

  const pauseRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;

    mediaRecorderRef.current.pause();
    setIsPaused(true);

    // Make sure we stop the timer
    stopTimer();

    // Stop visualizing audio levels
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    toast('Recording paused');
  };

  const resumeRecording = () => {
    if (!mediaRecorderRef.current) return;

    try {
      // Only resume if we're in paused state
      if (mediaRecorderRef.current.state === 'paused') {
        mediaRecorderRef.current.resume();
      }

      setIsPaused(false);

      // Make sure any existing timer is cleared before starting a new one
      stopTimer();
      startTimer();

      // Resume visualizing audio levels
      if (!animationFrameRef.current) {
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      }

      toast('Recording resumed');
    } catch (error) {
      console.error('Error resuming recording:', error);
      toast.error('Failed to resume recording');
    }
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

        // Stop visualizing audio levels
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }

        // Create a URL for the audio blob and set it for the player
        const audioUrl = URL.createObjectURL(audioBlob);

        // Create a temporary voice sample for preview
        const tempSample: VoiceSample = {
          id: 'temp-recording',
          fileKey: '',
          sampleName: recordingName || `New Voice Sample`,
          duration: formatTime(recordingTime),
          durationSeconds: recordingTime.toString(),
          audioUrl,
          isPlaying: false,
        };

        // Add to voice samples for preview
        setVoiceSamples((prev) => [...prev, tempSample]);

        toast.success('Recording completed');
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
    setIsNewRecordingMode(false);

    // Remove the temporary recording if it exists
    setVoiceSamples((prev) => prev.filter((s) => s.id !== 'temp-recording'));

    toast.info('Recording discarded');
  };

  const togglePlayAudio = (sampleId: string) => {
    setVoiceSamples((prev) =>
      prev.map((sample) => ({
        ...sample,
        isPlaying: sample.id === sampleId ? !sample.isPlaying : false,
      }))
    );
  };

  const saveVoiceIdentity = async () => {
    if (!audioBlobRef.current) {
      toast.error('No recording to save');
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);

      // Generate a filename
      const fileName = `voice-identity-${Date.now()}.mp3`;

      // Get a presigned upload URL using the server action
      const urlRes = await getVoiceIdentityUploadUrl({
        workspaceId,
        fileName,
        contentType: 'audio/mp3',
      });

      if (!urlRes.data) {
        throw new Error('Failed to get upload URL');
      }
      const uploadUrl = urlRes.data?.uploadUrl;
      const fileKey = urlRes.data?.fileKey;

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
            // Add voice identity to the workspace
            await saveUserVoiceIdentity({
              workspaceId,
              fileKey,
              sampleUrl: `${fileKey}`,
              duration: formatTime(recordingTime),
              durationSeconds: recordingTime.toString(),
              sampleName: recordingName,
            });

            toast.success('Voice sample saved');
            setIsUploading(false);
            setUploadProgress(0);
            resetRecordingState();
            audioBlobRef.current = null;
            setIsNewRecordingMode(false);

            // Remove the temporary recording
            setVoiceSamples((prev) => prev.filter((s) => s.id !== 'temp-recording'));

            // Invalidate queries to refresh the data
            invalidateVoiceIdentity(workspaceId);
          } catch (error) {
            console.error('Error saving voice identity:', error);
            setUploadError('Failed to save voice sample details.');
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
      let errorMessage = 'An error occurred while saving your voice sample.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      setUploadError(errorMessage);
      setIsUploading(false);
    }
  };

  const deleteSample = async () => {
    try {
      if (deleteAllSamples) {
        // Delete all voice samples
        await deleteUserVoiceIdentity({ workspaceId });
        toast.success('All voice samples deleted');
      } else if (sampleToDelete) {
        // Delete a specific voice sample
        await deleteUserVoiceIdentitySample({ workspaceId, sampleId: sampleToDelete });
        toast.success('Voice sample deleted');
      }

      setShowDeleteConfirm(false);
      setSampleToDelete(null);
      setDeleteAllSamples(false);

      // Invalidate queries to refresh the data
      invalidateVoiceIdentity(workspaceId);
    } catch (error) {
      toast.error('Failed to delete voice sample');
      console.error('Error deleting voice sample:', error);
    }
  };

  // Handler to request deletion of a specific sample
  const handleDeleteSample = (sampleId: string) => {
    setSampleToDelete(sampleId);
    setDeleteAllSamples(false);
    setShowDeleteConfirm(true);
  };

  // Handler to request deletion of all samples
  const handleDeleteAllSamples = () => {
    setSampleToDelete(null);
    setDeleteAllSamples(true);
    setShowDeleteConfirm(true);
  };

  // Start a new recording (only if we haven't reached the limit)
  const handleStartNewRecording = () => {
    if (voiceSamples.length >= 3) {
      toast.error('Maximum of 3 voice samples allowed');
      return;
    }
    startRecording();
  };

  return (
    <div className={className}>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            variant={buttonVariant}
            size={buttonLabel ? 'default' : 'icon'}
            className={cn('voice-identity-trigger', buttonClassName)}
          >
            {buttonLabel || <Mic className="h-4 w-4" />}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {hasVoiceIdentity ? 'Your Voice Samples' : 'Set Up Voice Identity'}
            </DialogTitle>
            <DialogDescription>
              {hasVoiceIdentity
                ? 'Your voice samples help identify you in meeting transcripts. You can have up to 3 samples (max 1 minute each).'
                : 'Record up to 3 voice samples to help identify you in meeting transcripts. Each sample has different text to help improve recognition.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Maximum Recording Warning */}
            {maxRecordingReached &&
              !isRecording &&
              !voiceSamples.some((s) => s.id === 'temp-recording') && (
                <div className="flex items-center gap-2 rounded-md bg-amber-50 p-3 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <p className="text-sm">
                    You've reached the maximum of 3 voice samples. Delete a sample to add a new one.
                  </p>
                </div>
              )}

            {/* Sample text to read for recording */}
            {currentSampleText && (isRecording || (!isRecording && !hasVoiceIdentity)) && (
              <Card className="bg-muted/50 gap-2">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    {isRecording ? 'Please read the following text:' : 'You will be asked to read:'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">
                    {isRecording && (
                      <span className="text-primary text-lg font-medium">
                        "{currentSampleText.text}"
                      </span>
                    )}
                    {!isRecording && (
                      <span className="text-muted-foreground italic">
                        A short passage with common meeting phrases. Press record when ready and
                        stop when you've finished reading.
                      </span>
                    )}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Voice Sample Cards */}
            {!isRecording && voiceSamples.length > 0 && (
              <div className="space-y-3">
                {voiceSamples.map((sample) => (
                  <Card key={sample.id} className="overflow-hidden">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{sample.sampleName}</CardTitle>
                        {sample.id !== 'temp-recording' && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleDeleteSample(sample.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Delete this sample</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs font-normal">
                          {sample.duration || '00:00'}
                        </Badge>
                        {sample.createdAt && (
                          <p className="text-muted-foreground text-xs">
                            {formatDistanceToNow(sample.createdAt, { addSuffix: true })}
                          </p>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-1 pb-3">
                      {sample.audioUrl && (
                        <AudioPlayer
                          src={sample.audioUrl}
                          isPlaying={sample.isPlaying || false}
                          onPlayPause={() => togglePlayAudio(sample.id)}
                          totalDurationSeconds={
                            sample.durationSeconds
                              ? parseInt(sample.durationSeconds, 10)
                              : undefined
                          }
                          className="w-full"
                        />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Recording in progress UI */}
            {isRecording && (
              <div className="space-y-4">
                {/* Audio visualization */}
                <div className="mb-4 flex w-full justify-center">
                  <div className="h-16 w-full">
                    <motion.div
                      className="bg-primary/80 mx-auto h-16 w-1/2 rounded-lg"
                      style={{
                        scaleY: isPaused ? 0.05 : audioLevel * 3,
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

                {/* Recording timer */}
                <div className="mb-4 text-center">
                  <p className="font-mono text-2xl font-medium">{formatTime(recordingTime)}</p>
                  <p className="text-muted-foreground text-sm">
                    {isPaused
                      ? recordingTime > 0
                        ? 'Recording paused'
                        : 'Ready to record - read the text above, then press the microphone button to start'
                      : recordingTime >= 60
                        ? 'Maximum duration reached (1 minute)'
                        : 'Recording... Press pause when you finish reading'}
                  </p>
                </div>

                {/* Recording controls */}
                <div className="flex justify-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 rounded-full"
                    onClick={cancelRecording}
                  >
                    <X className="h-5 w-5" />
                  </Button>

                  {isPaused ? (
                    <Button
                      size="icon"
                      className="h-12 w-12 rounded-full bg-green-500 hover:bg-green-600"
                      onClick={resumeRecording}
                    >
                      <Mic className="h-5 w-5" />
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      className="h-12 w-12 rounded-full bg-yellow-500 hover:bg-yellow-600"
                      onClick={pauseRecording}
                      disabled={recordingTime >= 60}
                    >
                      <Pause className="h-5 w-5" />
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 rounded-full"
                    onClick={stopRecording}
                  >
                    <Square className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            )}

            {/* Recording name input - only show when a new recording is made */}
            {!isRecording && voiceSamples.some((s) => s.id === 'temp-recording') && (
              <div className="space-y-2">
                <Input
                  value={recordingName}
                  onChange={(e) => setRecordingName(e.target.value)}
                  placeholder="Name your voice sample"
                  disabled={isUploading}
                />
              </div>
            )}

            {/* Upload progress */}
            {isUploading && (
              <div className="space-y-2">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-muted-foreground mt-2 text-center text-sm">
                  Uploading voice sample... {uploadProgress}%
                </p>
              </div>
            )}

            {uploadError && (
              <p className="text-destructive mt-2 text-center text-sm">{uploadError}</p>
            )}
          </div>

          <DialogFooter className="flex-col space-y-2 sm:flex-row sm:justify-between sm:space-y-0 sm:space-x-2">
            <div className="flex space-x-2">
              {hasVoiceIdentity &&
                !isRecording &&
                voiceSamples.length > 0 &&
                !voiceSamples.some((s) => s.id === 'temp-recording') && (
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAllSamples}
                    disabled={isUploading}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete All Samples
                  </Button>
                )}
            </div>

            <div className="flex space-x-2">
              {voiceSamples.some((s) => s.id === 'temp-recording') ? (
                <Button onClick={saveVoiceIdentity} disabled={isUploading}>
                  {isUploading ? 'Uploading...' : 'Save Voice Sample'}
                </Button>
              ) : (
                !isRecording &&
                // Use PulseButton if user has fewer than 3 samples and isn't at max
                (voiceSamples.length < 3 ? (
                  <Button
                    onClick={handleStartNewRecording}
                    disabled={isUploading}
                    className="relative animate-bounce"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {voiceSamples.length > 0
                      ? `Record Sample ${voiceSamples.length + 1}`
                      : 'Record Sample 1'}
                  </Button>
                ) : (
                  <Button onClick={handleStartNewRecording} disabled={true}>
                    <Plus className="mr-2 h-4 w-4" />
                    Record Sample (Max Reached)
                  </Button>
                ))
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {deleteAllSamples ? 'Delete All Voice Samples?' : 'Delete Voice Sample?'}
            </DialogTitle>
            <DialogDescription>
              {deleteAllSamples
                ? 'Are you sure you want to delete all your voice samples? This action cannot be undone.'
                : 'Are you sure you want to delete this voice sample? This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteConfirm(false);
                setSampleToDelete(null);
                setDeleteAllSamples(false);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteSample}>
              {deleteAllSamples ? 'Delete All Samples' : 'Delete Sample'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
