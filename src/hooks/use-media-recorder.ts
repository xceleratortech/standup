import { useState, useEffect, useRef, useCallback } from 'react';

// Extend Window interface to include our custom function
declare global {
  interface Window {
    addDraftRecording?: (blob: Blob, duration: number) => string | null;
  }
}

type RecordingState = 'inactive' | 'recording' | 'paused' | 'stopped';

interface UseMediaRecorderProps {
  meetingId?: string;
  onRecordingComplete?: (blob: Blob, duration: number) => void;
  autoSaveAsDraft?: boolean;
}

export function useMediaRecorder({
  meetingId,
  onRecordingComplete,
  autoSaveAsDraft = true,
}: UseMediaRecorderProps = {}) {
  const [recordingState, setRecordingState] =
    useState<RecordingState>('inactive');
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const mediaChunks = useRef<Blob[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Check if recording already exists in localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const draftInProgress = localStorage.getItem('recordingInProgress');
        if (draftInProgress) {
          const parsed = JSON.parse(draftInProgress);
          if (parsed && parsed.meetingId === meetingId) {
            // Only restore if it's for the current meeting
            setRecordingState('stopped');
            // Create blob from array buffer
            if (parsed.blobData && parsed.blobType) {
              const uint8Array = new Uint8Array(parsed.blobData);
              const blob = new Blob([uint8Array], { type: parsed.blobType });
              setRecordedBlob(blob);
              setDuration(parsed.duration || 0);
            }
          }
        }
      } catch (e) {
        console.error('Error loading recording in progress:', e);
      }
    }
  }, [meetingId]);

  // Set up timer for recording duration
  const startTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    startTimeRef.current = Date.now() - duration * 1000;

    timerRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsedSeconds = (Date.now() - startTimeRef.current) / 1000;
        setDuration(elapsedSeconds);
      }
    }, 100);
  }, [duration]);

  // Stop the timer
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      mediaChunks.current = [];
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      mediaRecorder.current = new MediaRecorder(stream);

      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          mediaChunks.current.push(e.data);
        }
      };

      mediaRecorder.current.onstop = () => {
        const blob = new Blob(mediaChunks.current, { type: 'audio/webm' });
        setRecordedBlob(blob);
        setRecordingState('stopped');
        stopTimer();

        // Save to localStorage for recovery
        saveRecordingToStorage(blob);

        // Automatically add to draft recordings system if it exists and autoSaveAsDraft is true
        if (
          autoSaveAsDraft &&
          typeof window !== 'undefined' &&
          window.addDraftRecording
        ) {
          try {
            window.addDraftRecording(blob, duration);
          } catch (e) {
            console.error('Error adding to draft recordings:', e);
          }
        }

        // Callback if provided
        if (onRecordingComplete) {
          onRecordingComplete(blob, duration);
        }

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.current.start(100);
      setRecordingState('recording');
      startTimer();
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Could not access microphone. Please check permissions.');
      setRecordingState('inactive');
    }
  }, [startTimer, stopTimer, duration, onRecordingComplete, autoSaveAsDraft]);

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (mediaRecorder.current && recordingState === 'recording') {
      mediaRecorder.current.pause();
      setRecordingState('paused');
      stopTimer();
    }
  }, [recordingState, stopTimer]);

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (mediaRecorder.current && recordingState === 'paused') {
      mediaRecorder.current.resume();
      setRecordingState('recording');
      startTimer();
    }
  }, [recordingState, startTimer]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (
      mediaRecorder.current &&
      (recordingState === 'recording' || recordingState === 'paused')
    ) {
      mediaRecorder.current.stop();
      // State will be updated in the onstop handler
    }
  }, [recordingState]);

  // Reset recording state
  const resetRecording = useCallback(() => {
    setRecordingState('inactive');
    setRecordedBlob(null);
    setDuration(0);
    setError(null);
    mediaChunks.current = [];

    // Remove from localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('recordingInProgress');
    }
  }, []);

  // Save recording state to localStorage
  const saveRecordingToStorage = useCallback(
    async (blob: Blob) => {
      if (typeof window !== 'undefined' && meetingId) {
        try {
          // Convert blob to array buffer for storage
          const buffer = await blob.arrayBuffer();
          const uint8Array = new Uint8Array(buffer);

          localStorage.setItem(
            'recordingInProgress',
            JSON.stringify({
              meetingId,
              duration,
              blobData: Array.from(uint8Array),
              blobType: blob.type,
              timestamp: Date.now(),
            })
          );
        } catch (e) {
          console.error('Error saving recording to storage:', e);
        }
      }
    },
    [duration, meetingId]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      if (mediaRecorder.current && recordingState === 'recording') {
        // Don't actually stop if recording, just let it persist
      }
    };
  }, [recordingState, stopTimer]);

  return {
    recordingState,
    recordedBlob,
    duration,
    error,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecording,
  };
}
