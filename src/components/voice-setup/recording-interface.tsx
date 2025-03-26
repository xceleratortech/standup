import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mic, Pause, Square, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { VoiceSample } from '../voice-setup-page';
import { useSession } from '@/lib/auth-client';
import { saveUserVoiceIdentity, getVoiceIdentityUploadUrl } from '@/lib/actions/workspace';
import { AudioPlayer } from '@/components/ui/audio-player';

interface RecordingInterfaceProps {
  workspaceId: string;
  currentSampleText: {
    title: string;
    text: string;
  } | null;
  sampleNumber: number;
  onCancel: () => void;
  onSaved: (sample: VoiceSample) => void;
}

export function RecordingInterface({
  workspaceId,
  currentSampleText,
  sampleNumber,
  onCancel,
  onSaved,
}: RecordingInterfaceProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [recordingName, setRecordingName] = useState('');
  const [recordingFinished, setRecordingFinished] = useState(false);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  const { data: session } = useSession();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioDataRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Set initial recording name
  useEffect(() => {
    if (currentSampleText) {
      setRecordingName(`Sample ${sampleNumber}: ${currentSampleText.title}`);
    } else {
      setRecordingName(`Sample ${sampleNumber}: ${session?.user?.name || 'Voice Sample'}`);
    }
  }, [currentSampleText, sampleNumber, session?.user?.name]);

  // Initialize recording when component mounts
  useEffect(() => {
    startRecording();
    return () => {
      cleanupRecording();
    };
  }, []);

  const cleanupRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Stop the media recorder and tracks if active
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {
          console.error('Error stopping media recorder:', e);
        }
      }

      try {
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      } catch (e) {
        console.error('Error stopping media tracks:', e);
      }
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

  const startRecording = async () => {
    try {
      // Reset state
      setIsRecording(true);
      setIsPaused(true);
      setRecordingTime(0);
      audioChunksRef.current = [];
      audioBlobRef.current = null;
      setUploadError(null);

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
      mediaRecorderRef.current.start();

      toast.success('Ready to record. Click the microphone button to start');
    } catch (error) {
      console.error('Error initializing recording:', error);
      toast.error('Failed to start recording', {
        description: 'Please check your microphone permissions.',
      });
      onCancel();
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
        setIsPaused(true);
        setRecordingFinished(true);

        // Create a URL for the audio blob for preview playback
        const audioUrl = URL.createObjectURL(audioBlob);
        setPreviewAudioUrl(audioUrl);

        // Stop visualizing audio levels
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }

        toast.success('Recording completed');
        resolve();
      };

      mediaRecorderRef.current.stop();

      // Stop all tracks in the stream
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    });
  };

  // Handle audio playback toggle
  const togglePlayAudio = () => {
    setIsAudioPlaying(!isAudioPlaying);
  };

  const cancelRecording = async () => {
    // Clean up audio URL if it exists
    if (previewAudioUrl) {
      URL.revokeObjectURL(previewAudioUrl);
    }
    cleanupRecording();
    onCancel();
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
            const result = await saveUserVoiceIdentity({
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

            // Create a sample object to pass back
            const savedSample: VoiceSample = {
              id: result.data!.id,
              fileKey: fileKey,
              sampleName: recordingName,
              duration: formatTime(recordingTime),
              durationSeconds: recordingTime.toString(),
              createdAt: new Date(),
              isPlaying: false,
            };

            // Notify parent component
            onSaved(savedSample);
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

  if (recordingFinished) {
    // Saving/naming screen after recording is finished
    return (
      <div className="mt-6 space-y-4 rounded-lg border p-6">
        <h2 className="text-xl font-semibold">Review and Save Your Recording</h2>

        {/* Preview audio player */}
        {previewAudioUrl && (
          <div className="mb-4">
            <p className="mb-2 text-sm font-medium">Preview recording:</p>
            <AudioPlayer
              src={previewAudioUrl}
              isPlaying={isAudioPlaying}
              onPlayPause={togglePlayAudio}
              totalDurationSeconds={recordingTime}
              className="w-full"
            />
          </div>
        )}

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
          <Button onClick={saveVoiceIdentity} disabled={isUploading || !recordingName.trim()}>
            {isUploading ? 'Uploading...' : 'Save Voice Sample'}
          </Button>
        </div>
      </div>
    );
  }

  // Active recording interface
  return (
    <div className="space-y-6 rounded-lg border p-6">
      <h2 className="text-xl font-semibold">Recording Sample {sampleNumber}</h2>

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
  );
}
