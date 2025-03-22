'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Global audio manager to prevent multiple instances
const audioManager = {
  activeElement: null as HTMLAudioElement | null,
  isInitialized: false,
  initialize() {
    if (this.isInitialized) return;

    // Remove any existing audio elements with our ID to prevent duplicates
    const existingElements = document.querySelectorAll('#meeting-audio-player');
    existingElements.forEach((el) => el.remove());

    // Create a fresh audio element
    const audio = document.createElement('audio');
    audio.id = 'meeting-audio-player';
    audio.preload = 'auto';
    document.body.appendChild(audio);
    this.activeElement = audio;
    this.isInitialized = true;
    console.log('🎵 Audio manager initialized with new audio element');
  },
  getAudioElement() {
    if (!this.isInitialized) {
      this.initialize();
    }
    return this.activeElement;
  },
  cleanup() {
    if (this.activeElement) {
      this.activeElement.pause();
      this.activeElement.src = '';
    }
  },
};

// Initialize on module load
if (typeof window !== 'undefined') {
  audioManager.initialize();
}

interface AudioPlayerProps {
  src: string;
  isPlaying: boolean;
  onPlayPause: () => void;
  className?: string;
  totalDurationSeconds?: number;
  initialTime?: number;
  onTimeUpdate?: (time: number) => void;
}

export function AudioPlayer({
  src,
  isPlaying,
  onPlayPause,
  className,
  totalDurationSeconds,
  initialTime = 0,
  onTimeUpdate,
}: AudioPlayerProps) {
  const [currentTime, setCurrentTime] = useState(initialTime);
  const [duration, setDuration] = useState(totalDurationSeconds || 0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  // Keep track of this component's instance
  const componentIdRef = useRef(`player-${Math.random().toString(36).substring(2, 9)}`);
  const sourceChangedRef = useRef(false);
  const timeUpdateRef = useRef<number | null>(null);
  const lastTimeUpdateRef = useRef(Date.now());
  const timeUpdateThreshold = 250; // ms between updates
  const listenerInitializedRef = useRef(false);
  const animationRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Setup audio element and listeners
  useEffect(() => {
    // Get the shared audio element
    const audio = audioManager.getAudioElement();
    if (!audio) return;

    audioRef.current = audio;

    // Only setup listeners once per component instance
    if (!listenerInitializedRef.current) {
      console.log(`🎵 Setting up listeners for ${componentIdRef.current}`);

      // Clean up any existing listeners
      const newCleanup = setupAudioListeners(audio);
      listenerInitializedRef.current = true;

      // Set initial source
      updateAudioSource(src);

      return () => {
        console.log(`🎵 Cleaning up listeners for ${componentIdRef.current}`);
        newCleanup();
        if (isPlaying) {
          audio.pause();
        }
      };
    }
  }, []);

  // Update source when it changes
  useEffect(() => {
    updateAudioSource(src);
  }, [src]);

  // Handle play/pause
  useEffect(() => {
    const audio = audioManager.getAudioElement();
    if (!audio) return;

    if (isPlaying) {
      // Make sure no other audio is playing by accessing manager
      sourceChangedRef.current ? waitForCanPlay(audio) : playAudio(audio);

      // Start animation frame for smoother slider updates
      startSliderUpdates();
    } else {
      // Only pause if this component was controlling playback
      if (audio.src && audio.src.includes(src)) {
        audio.pause();
        stopSliderUpdates();
      }
    }
  }, [isPlaying, src]);

  // Handle volume and mute
  useEffect(() => {
    const audio = audioManager.getAudioElement();
    if (audio) {
      audio.volume = isMuted ? 0 : volume;
      audio.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Set initial time when it changes
  useEffect(() => {
    const audio = audioManager.getAudioElement();
    if (audio && initialTime > 0 && isPlaying) {
      audio.currentTime = initialTime;
      setCurrentTime(initialTime);
    }
  }, [initialTime, isPlaying]);

  // Update duration when totalDurationSeconds changes
  useEffect(() => {
    if (totalDurationSeconds) {
      setDuration(totalDurationSeconds);
    }
  }, [totalDurationSeconds]);

  // Helper function to play audio with waiting for canplay
  function waitForCanPlay(audio: HTMLAudioElement) {
    const canPlayHandler = () => {
      playAudio(audio);
      sourceChangedRef.current = false;
      audio.removeEventListener('canplay', canPlayHandler);
    };

    audio.addEventListener('canplay', canPlayHandler);

    // Fallback timer in case canplay never fires
    setTimeout(() => {
      if (sourceChangedRef.current) {
        console.log('Canplay timeout, trying to play anyway');
        sourceChangedRef.current = false;
        playAudio(audio);
        audio.removeEventListener('canplay', canPlayHandler);
      }
    }, 1000);
  }

  // Helper function to play audio with error handling
  function playAudio(audio: HTMLAudioElement) {
    try {
      // Make sure we're playing the right source
      if (!audio.src.includes(src)) {
        console.log('Source mismatch, updating source before playing');
        updateAudioSource(src);
        return; // This will trigger the canplay handler
      }

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.error('Error playing audio:', error);
          if (error.name === 'NotAllowedError') {
            onPlayPause();
            toast.error('Please click play to start audio');
          }
        });
      }
    } catch (error) {
      console.error('Play error:', error);
      onPlayPause();
    }
  }

  // Helper function to update audio source
  function updateAudioSource(newSrc: string) {
    const audio = audioManager.getAudioElement();
    if (!audio) return;

    // Check if source actually needs to change
    if (!audio.src || !audio.src.includes(newSrc)) {
      console.log(`🎵 Updating source to: ${newSrc}`);
      sourceChangedRef.current = true;

      // Stop any current playback
      audio.pause();

      // Clean up old source
      audio.src = '';
      audio.load();

      // Set new source and load
      audio.src = newSrc;
      audio.load();
    }
  }

  // Helper to set up audio event listeners
  function setupAudioListeners(audio: HTMLAudioElement) {
    // Handle errors
    const handleError = () => {
      console.error('Audio error:', audio.error);
      toast.error(`Audio error: ${audio.error?.message || 'Unknown error'}`);
    };

    // Handle timeupdate with throttling
    const handleTimeUpdate = () => {
      const now = Date.now();
      if (now - lastTimeUpdateRef.current > timeUpdateThreshold) {
        // Only update UI for this instance if the audio is playing our source
        if (audio.src.includes(src)) {
          const newTime = audio.currentTime || 0;
          setCurrentTime(newTime);
          if (onTimeUpdate) {
            onTimeUpdate(newTime);
          }
        }
        lastTimeUpdateRef.current = now;
      }
    };

    // Handle ended event
    const handleEnded = () => {
      // Only handle end event for our source
      if (audio.src.includes(src)) {
        setCurrentTime(0);
        if (onTimeUpdate) onTimeUpdate(0);
        onPlayPause();
      }
    };

    // Handle metadata loading
    const handleLoadedMetadata = () => {
      // Only set duration if we're playing this source, have no explicit duration, and duration is valid
      if (
        audio.src.includes(src) &&
        !totalDurationSeconds &&
        !isNaN(audio.duration) &&
        isFinite(audio.duration)
      ) {
        console.log('Audio loaded with duration:', audio.duration);
        setDuration(audio.duration);
      }
    };

    // Add all listeners
    audio.addEventListener('error', handleError);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    // Return cleanup function
    return () => {
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);

      // Clear any throttled updates
      if (timeUpdateRef.current) {
        clearTimeout(timeUpdateRef.current);
      }
    };
  }

  // Start slider updates using requestAnimationFrame for smoother updates
  function startSliderUpdates() {
    stopSliderUpdates();

    const updateSlider = () => {
      const audio = audioRef.current;
      if (audio && !audio.paused && audio.src.includes(src)) {
        setCurrentTime(audio.currentTime);
        if (onTimeUpdate) {
          onTimeUpdate(audio.currentTime);
        }
        animationRef.current = requestAnimationFrame(updateSlider);
      }
    };

    animationRef.current = requestAnimationFrame(updateSlider);
  }

  // Stop animation frame updates
  function stopSliderUpdates() {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }

  // Cleanup animation frame on component unmount
  useEffect(() => {
    return () => {
      stopSliderUpdates();
    };
  }, []);

  // Seek handler
  const handleSeek = (value: number[]) => {
    const audio = audioManager.getAudioElement();
    if (!audio) return;

    // Only allow seeking if we're playing this source
    if (audio.src.includes(src)) {
      const newTime = value[0];
      audio.currentTime = newTime;
      setCurrentTime(newTime);

      if (onTimeUpdate) {
        onTimeUpdate(newTime);
      }
    }
  };

  // Format time as MM:SS
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn('flex w-full items-center space-x-2', className)}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onPlayPause}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>

      <div className="flex flex-1 items-center space-x-2">
        <span className="text-muted-foreground w-10 text-xs">{formatTime(currentTime)}</span>

        <Slider
          value={[currentTime]}
          min={0}
          max={duration || 1}
          step={0.1}
          onValueChange={handleSeek}
          className="flex-1"
          aria-label="Seek"
        />

        <span className="text-muted-foreground w-10 text-xs">{formatTime(duration)}</span>
      </div>

      {/* Replace the volume control with a simple mute/unmute button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => setIsMuted(!isMuted)}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </Button>
    </div>
  );
}
