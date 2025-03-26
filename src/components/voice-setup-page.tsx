'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Square,
  Pause,
  Trash2,
  X,
  Plus,
  AlertTriangle,
  Check,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { InferSelectModel } from 'drizzle-orm';
import { cn } from '@/lib/utils';
import { userVoiceIdentity } from '@/lib/db/schema';
import { useSession } from '@/lib/auth-client';
import { getVoiceSampleText } from '@/lib/config/voice-samples';
import { Link } from '@/components/ui/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useRouter } from 'next/navigation';

interface VoiceSetupPageProps {
  workspaceId: string;
  initialVoiceIdentities: InferSelectModel<typeof userVoiceIdentity>[];
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

export function VoiceSetupPage({ workspaceId, initialVoiceIdentities }: VoiceSetupPageProps) {
  const [step, setStep] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [recordingName, setRecordingName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sampleToDelete, setSampleToDelete] = useState<string | null>(null);
  const [deleteAllSamples, setDeleteAllSamples] = useState(false);
  const [voiceSamples, setVoiceSamples] = useState<VoiceSample[]>([]);
  const [currentSampleText, setCurrentSampleText] = useState<{
    title: string;
    text: string;
  } | null>(null);
  const [allSamplesCompleted, setAllSamplesCompleted] = useState(false);

  const router = useRouter();
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
    // Reset recording state
    resetRecordingState();

    // Initialize voice samples from provided identities
    if (initialVoiceIdentities && initialVoiceIdentities.length > 0) {
      const samples = initialVoiceIdentities.map((identity) => ({
        id: identity.id,
        fileKey: identity.fileKey,
        sampleName:
          identity.sampleName || `Voice Sample ${initialVoiceIdentities.indexOf(identity) + 1}`,
        duration: identity.duration || '00:00',
        durationSeconds: identity.durationSeconds || '0',
        createdAt: identity.createdAt ? new Date(identity.createdAt) : undefined,
        isPlaying: false,
      }));
      setVoiceSamples(samples);

      // Check if all samples are completed
      setAllSamplesCompleted(samples.length >= 3);

      // Fetch audio URLs for all samples
      samples.forEach((sample) => {
        fetchAudioUrl(sample.id, sample.fileKey);
      });

      // Set the appropriate sample text based on the next sample number
      const nextSampleNumber = samples.length + 1;
      if (nextSampleNumber <= 3) {
        setCurrentSampleText(getVoiceSampleText(nextSampleNumber));
      }

      // If we already have samples, start at the review step
      if (samples.length > 0) {
        setStep(1);
      }
    } else {
      setVoiceSamples([]);
      setAllSamplesCompleted(false);
      // Set the first sample text
      setCurrentSampleText(getVoiceSampleText(1));
    }

    setRecordingName(`Sample ${voiceSamples.length + 1}: ${session?.user.name || 'Me'}`);
  }, [initialVoiceIdentities, session?.user.name]);

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

            // Remove the temporary recording
            setVoiceSamples((prev) => prev.filter((s) => s.id !== 'temp-recording'));

            // Invalidate queries to refresh the data
            invalidateVoiceIdentity(workspaceId);

            // Check if all samples are completed
            const remainingSamples =
              3 -
              (voiceSamples.length - (voiceSamples.some((s) => s.id === 'temp-recording') ? 1 : 0));

            if (remainingSamples <= 0) {
              setAllSamplesCompleted(true);
              setStep(2); // Move to the completion step
            } else {
              // Move to the review step
              setStep(1);

              // Prepare for next sample if needed
              const nextSampleNumber =
                voiceSamples.length -
                (voiceSamples.some((s) => s.id === 'temp-recording') ? 1 : 0) +
                1;
              if (nextSampleNumber <= 3) {
                setCurrentSampleText(getVoiceSampleText(nextSampleNumber));
              }
            }
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
        setVoiceSamples([]);
        setAllSamplesCompleted(false);
        setStep(0); // Go back to introduction step
      } else if (sampleToDelete) {
        // Delete a specific voice sample
        await deleteUserVoiceIdentitySample({ workspaceId, sampleId: sampleToDelete });
        toast.success('Voice sample deleted');

        // Remove from our local state
        setVoiceSamples((prev) => prev.filter((sample) => sample.id !== sampleToDelete));

        // Update completion status
        if (voiceSamples.length <= 3) {
          setAllSamplesCompleted(false);
        }
      }

      setShowDeleteConfirm(false);
      setSampleToDelete(null);
      setDeleteAllSamples(false);

      // Invalidate queries to refresh the data
      invalidateVoiceIdentity(workspaceId);

      // Set the current sample text for the next recording
      const nextSampleNumber = voiceSamples.length;
      if (nextSampleNumber < 3) {
        setCurrentSampleText(getVoiceSampleText(nextSampleNumber + 1));
      }
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

  const returnToWorkspace = () => {
    router.push(`/workspace/${workspaceId}`);
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return renderIntroductionStep();
      case 1:
        return renderReviewAndRecordStep();
      case 2:
        return renderCompletionStep();
      default:
        return renderIntroductionStep();
    }
  };

  const renderIntroductionStep = () => {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-center text-3xl font-bold tracking-tight">Voice Identity Setup</h1>
          <p className="text-muted-foreground text-center text-lg">
            Set up your voice identity to enhance your experience with Standup
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Why Voice Identity Is Important</CardTitle>
            <CardDescription>
              Voice identification is a critical component of Standup that enables many of our core
              features
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="bg-primary text-primary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                  <Check className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold">Accurate Transcription Attribution</h3>
                  <p className="text-muted-foreground text-sm">
                    Your voice samples help our system correctly identify who said what in meeting
                    recordings
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="bg-primary text-primary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                  <Check className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold">Personalized Meeting Highlights</h3>
                  <p className="text-muted-foreground text-sm">
                    Get personalized summaries of what matters most to you in meetings you attend
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="bg-primary text-primary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                  <Check className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold">Action Item Tracking</h3>
                  <p className="text-muted-foreground text-sm">
                    Automatically identify and track action items assigned to you during meetings
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-md bg-amber-50 p-4 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium">Voice identity is required</h4>
                  <p className="text-sm">
                    Many features of Standup rely on voice identification. Without it, we won't be
                    able to accurately identify your contributions in meetings or generate
                    personalized insights for you.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={() => setStep(1)}>
              Continue to Voice Setup
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  };

  const renderReviewAndRecordStep = () => {
    const samplesCount = voiceSamples.filter((s) => s.id !== 'temp-recording').length;
    const remainingSamples = 3 - samplesCount;

    return (
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            {allSamplesCompleted
              ? 'Your Voice Samples'
              : `Record Voice Samples (${samplesCount}/3)`}
          </h1>
          <p className="text-muted-foreground text-lg">
            {allSamplesCompleted
              ? 'All voice samples have been recorded. You can review or replace them below.'
              : `Record ${remainingSamples} more sample${remainingSamples !== 1 ? 's' : ''} to complete your voice identity.`}
          </p>
        </div>

        <div className="rounded-lg border p-6">
          {/* Voice Sample Cards */}
          {voiceSamples.length > 0 && (
            <div className="mb-6 space-y-4">
              <h2 className="text-xl font-semibold">Your Voice Samples</h2>
              <div className="space-y-3">
                {voiceSamples.map((sample) => (
                  <Card key={sample.id} className="overflow-hidden">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{sample.sampleName}</CardTitle>
                        {sample.id !== 'temp-recording' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDeleteSample(sample.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
            </div>
          )}

          {/* Recording UI */}
          {isRecording ? (
            <div className="space-y-6 rounded-lg border p-6">
              <h2 className="text-xl font-semibold">Recording Sample {samplesCount + 1}</h2>

              {/* Sample text to read */}
              {currentSampleText && (
                <Card className="bg-muted/50">
                  <CardHeader>
                    <CardTitle className="text-base">Please read the following text:</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-primary text-lg font-medium">"{currentSampleText.text}"</p>
                  </CardContent>
                </Card>
              )}

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
          ) : (
            // New recording button
            !voiceSamples.some((s) => s.id === 'temp-recording') &&
            remainingSamples > 0 && (
              <div className="flex flex-col items-center rounded-lg border p-6">
                <h2 className="mb-4 text-xl font-semibold">
                  Record Sample {samplesCount + 1} of 3
                </h2>
                {currentSampleText && (
                  <div className="mb-4">
                    <p className="mb-2 text-center font-medium">{currentSampleText.title}</p>
                    <p className="text-muted-foreground text-center text-sm">
                      You'll be asked to read a short passage with common meeting phrases.
                    </p>
                  </div>
                )}
                <Button onClick={startRecording} size="lg" className="mt-4">
                  <Mic className="mr-2 h-5 w-5" />
                  Start Recording
                </Button>
              </div>
            )
          )}

          {/* Recording name input - only show when a new recording is made */}
          {!isRecording && voiceSamples.some((s) => s.id === 'temp-recording') && (
            <div className="mt-6 space-y-4 rounded-lg border p-6">
              <h2 className="text-xl font-semibold">Save Your Recording</h2>
              <div className="space-y-2">
                <label htmlFor="recording-name" className="text-sm font-medium">
                  Recording Name
                </label>
                <Input
                  id="recording-name"
                  value={recordingName}
                  onChange={(e) => setRecordingName(e.target.value)}
                  placeholder="Name your voice sample"
                  disabled={isUploading}
                />
              </div>

              {/* Upload progress */}
              {isUploading && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-muted-foreground mt-2 text-center text-sm">
                    Uploading voice sample... {uploadProgress}%
                  </p>
                </div>
              )}

              {uploadError && <p className="text-destructive mt-2 text-sm">{uploadError}</p>}

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={cancelRecording} disabled={isUploading}>
                  Discard
                </Button>
                <Button onClick={saveVoiceIdentity} disabled={isUploading}>
                  {isUploading ? 'Uploading...' : 'Save Voice Sample'}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep(0)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Introduction
          </Button>

          {allSamplesCompleted && (
            <Button onClick={() => setStep(2)}>
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderCompletionStep = () => {
    return (
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Voice Identity Complete!</h1>
          <p className="text-muted-foreground text-lg">
            You've successfully set up your voice identity with Standup
          </p>
        </div>

        <Card className="border-green-200 dark:border-green-800">
          <CardHeader>
            <div className="flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <Check className="h-6 w-6 text-green-700 dark:text-green-300" />
              </div>
            </div>
            <CardTitle className="text-center">All Voice Samples Recorded</CardTitle>
            <CardDescription className="text-center">
              Your voice identity is now ready to use with all Standup features
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Check className="mt-0.5 h-5 w-5 text-green-600" />
                <div>
                  <h3 className="font-medium">Accurate Attribution in Transcripts</h3>
                  <p className="text-muted-foreground text-sm">
                    Your speech will be correctly attributed to you in meeting transcripts
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Check className="mt-0.5 h-5 w-5 text-green-600" />
                <div>
                  <h3 className="font-medium">Personalized Insights</h3>
                  <p className="text-muted-foreground text-sm">
                    We'll identify your contributions and provide personalized summaries and
                    insights
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Check className="mt-0.5 h-5 w-5 text-green-600" />
                <div>
                  <h3 className="font-medium">Action Item Tracking</h3>
                  <p className="text-muted-foreground text-sm">
                    Action items assigned to you will be properly tracked and highlighted
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-md bg-blue-50 p-4 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                <div>
                  <p className="text-sm">
                    You can always update your voice samples later by returning to this page from
                    your workspace home page.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-3">
            <Button className="w-full" onClick={returnToWorkspace}>
              Return to Workspace
            </Button>

            <Button variant="outline" onClick={() => setStep(1)}>
              Review Voice Samples
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  };

  return (
    <div className="container mx-auto max-w-2xl py-12">
      {renderStep()}

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
            <h2 className="text-xl font-semibold">
              {deleteAllSamples ? 'Delete All Voice Samples?' : 'Delete Voice Sample?'}
            </h2>
            <p className="text-muted-foreground my-4">
              {deleteAllSamples
                ? 'Are you sure you want to delete all your voice samples? This action cannot be undone.'
                : 'Are you sure you want to delete this voice sample? This action cannot be undone.'}
            </p>
            <div className="flex justify-end gap-2">
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
