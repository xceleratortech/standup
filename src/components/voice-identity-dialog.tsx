'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Square, Pause, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { AudioPlayer } from '@/components/ui/audio-player';
import { useVoiceIdentityDownloadUrl } from '@/lib/hooks/use-queries';
import {
  saveUserVoiceIdentity,
  deleteUserVoiceIdentity,
  getVoiceIdentityUploadUrl,
} from '@/lib/actions/workspace';
import { user } from '@/lib/db/auth-schema';
import { InferSelectModel } from 'drizzle-orm';

type User = InferSelectModel<typeof user>;

interface VoiceIdentityDialogProps {
  workspaceId: string;
  hasVoiceIdentity: boolean;
  voiceIdentity?: any;
  currentUser?: User;
}

export default function VoiceIdentityDialog({
  workspaceId,
  hasVoiceIdentity,
  voiceIdentity,
  currentUser,
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioDataRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const { mutateAsync: getDownloadUrl } = useVoiceIdentityDownloadUrl();

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
    if (isOpen && voiceIdentity) {
      setRecordingName(voiceIdentity.sampleUrl?.split('/').pop() || 'Voice Sample');

      // Fetch audio URL for existing voice identity when dialog opens
      if (hasVoiceIdentity && voiceIdentity.fileKey) {
        console.log('voice id', voiceIdentity);
        fetchAudioUrl(voiceIdentity.fileKey);
      }
    } else {
      setRecordingName(`Voice of ${currentUser?.name || 'Me'}`);
    }
  }, [isOpen, voiceIdentity, currentUser, hasVoiceIdentity]);

  // Fetch the audio URL from S3
  const fetchAudioUrl = async (fileKey: string) => {
    try {
      console.log('Fetching audio from S3, fileKey:', fileKey);
      const { downloadUrl } = await getDownloadUrl(fileKey);
      console.log('Received URL:', downloadUrl);
      setAudioUrl(downloadUrl);
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
    audioChunksRef.current = [];
    audioBlobRef.current = null;
    setUploadError(null);
  };

  const startRecording = async () => {
    try {
      // Reset state before starting a new recording
      resetRecordingState();

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

        // Stop visualizing audio levels
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }

        // Create a URL for the audio blob and set it for the player
        const audioUrl = URL.createObjectURL(audioBlob);
        setAudioUrl(audioUrl);

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
    toast.info('Recording discarded');
  };

  const togglePlayAudio = () => {
    setIsPlaying(!isPlaying);
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
      const { uploadUrl, fileKey } = await getVoiceIdentityUploadUrl({
        workspaceId,
        fileName,
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
            // Add voice identity to the workspace
            await saveUserVoiceIdentity({
              workspaceId,
              fileKey,
              sampleUrl: `${fileKey}`,
              duration: formatTime(recordingTime),
              durationSeconds: recordingTime.toString(),
            });

            toast.success('Voice identity saved');
            setIsUploading(false);
            setUploadProgress(0);
            resetRecordingState();
            audioBlobRef.current = null;
            setIsOpen(false);

            // Refresh the page to show the updated voice identity
            window.location.reload();
          } catch (error) {
            console.error('Error saving voice identity:', error);
            setUploadError('Failed to save voice identity details.');
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
      let errorMessage = 'An error occurred while saving your voice identity.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      setUploadError(errorMessage);
      setIsUploading(false);
    }
  };

  const deleteVoiceIdentity = async () => {
    try {
      await deleteUserVoiceIdentity({ workspaceId });
      toast.success('Voice identity deleted');
      setShowDeleteConfirm(false);
      setIsOpen(false);

      // Refresh the page to reflect the deletion
      window.location.reload();
    } catch (error) {
      toast.error('Failed to delete voice identity');
      console.error('Error deleting voice identity:', error);
    }
  };

  return (
    <>
      <Button
        variant={hasVoiceIdentity ? 'outline' : 'secondary'}
        size="sm"
        className={`flex items-center gap-1 ${hasVoiceIdentity ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}
        onClick={() => setIsOpen(true)}
      >
        {hasVoiceIdentity ? (
          <>
            <Mic className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Voice ID</span>
          </>
        ) : (
          <>
            <MicOff className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Set Voice ID</span>
          </>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => !isUploading && setIsOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {hasVoiceIdentity ? 'Your Voice Identity' : 'Set Up Voice Identity'}
            </DialogTitle>
            <DialogDescription>
              {hasVoiceIdentity
                ? 'Your voice identity helps identify you in meeting transcripts and recordings.'
                : 'Record a sample of your voice to help identify you in meeting transcripts.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Voice Sample Information */}
            {hasVoiceIdentity && !isRecording && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs font-normal">
                    {voiceIdentity?.duration || 'Unknown duration'}
                  </Badge>
                  <p className="text-muted-foreground text-xs">
                    {voiceIdentity?.createdAt
                      ? `Created ${formatDistanceToNow(new Date(voiceIdentity.createdAt), { addSuffix: true })}`
                      : 'Recently created'}
                  </p>
                </div>

                {/* Custom audio player */}
                {audioUrl && (
                  <div className="flex justify-center pt-2">
                    <AudioPlayer
                      src={audioUrl}
                      isPlaying={isPlaying}
                      onPlayPause={togglePlayAudio}
                      totalDurationSeconds={
                        voiceIdentity?.durationSeconds
                          ? parseInt(voiceIdentity.durationSeconds, 10)
                          : undefined
                      }
                      className="w-full"
                    />
                  </div>
                )}
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
                        scaleY: audioLevel * 3,
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
                    {isPaused ? 'Recording paused' : 'Recording...'}
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

            {/* Recording name input */}
            {!isRecording && (
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

            {/* Preview of recorded audio with custom player */}
            {audioBlobRef.current && !isRecording && (
              <div className="flex justify-center pt-2">
                <AudioPlayer
                  src={audioUrl || ''}
                  isPlaying={isPlaying}
                  onPlayPause={togglePlayAudio}
                  totalDurationSeconds={recordingTime}
                  className="w-full"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            {hasVoiceIdentity && !isRecording && !audioBlobRef.current && (
              <Button
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isUploading}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Voice ID
              </Button>
            )}

            {!isRecording && (
              <>
                {audioBlobRef.current ? (
                  <Button onClick={saveVoiceIdentity} disabled={isUploading}>
                    {isUploading ? 'Uploading...' : 'Save Voice Identity'}
                  </Button>
                ) : (
                  <Button onClick={startRecording} disabled={isUploading}>
                    <Mic className="mr-2 h-4 w-4" />
                    {hasVoiceIdentity ? 'Record New Sample' : 'Start Recording'}
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Voice Identity?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete your voice identity? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteVoiceIdentity}>
              Delete Voice Identity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
