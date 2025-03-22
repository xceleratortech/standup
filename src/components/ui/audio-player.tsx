'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

const formatTime = (seconds: number = 0) => {
  if (!isFinite(seconds)) return '--:--';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

interface AudioPlayerProps {
  src: string;
  title?: string;
  onClose?: () => void;
}

const AudioPlayer = ({ src, title, onClose }: AudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (audioRef.current) {
      const audio = audioRef.current;

      const onLoadedMetadata = () => {
        setDuration(audio.duration);
        setLoading(false);
      };

      const onEnded = () => {
        setIsPlaying(false);
        // Removed the onClose call here so the player stays open
      };

      audio.addEventListener('loadedmetadata', onLoadedMetadata);
      audio.addEventListener('ended', onEnded);

      return () => {
        audio.removeEventListener('loadedmetadata', onLoadedMetadata);
        audio.removeEventListener('ended', onEnded);
      };
    }
  }, [onClose]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !audioRef.current.muted;
      setIsMuted(!isMuted);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const progress =
        (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(isFinite(progress) ? progress : 0);
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current && audioRef.current.duration) {
      const value = parseFloat(e.target.value);
      const time = (value / 100) * audioRef.current.duration;
      if (isFinite(time)) {
        audioRef.current.currentTime = time;
        setProgress(value);
      }
    }
  };

  return (
    <div className='bg-secondary/20 w-full max-w-sm rounded-md p-2'>
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        src={src}
        className='hidden'
        preload='metadata'
      />

      {title && (
        <div className='mb-1 truncate text-sm font-medium'>{title}</div>
      )}

      <div className='flex items-center gap-2'>
        <Button
          variant='ghost'
          size='icon'
          className='h-8 w-8'
          onClick={togglePlay}
          disabled={loading}
        >
          {loading ? (
            <Spinner className='h-4 w-4' />
          ) : isPlaying ? (
            <Pause className='h-4 w-4' />
          ) : (
            <Play className='h-4 w-4' />
          )}
        </Button>

        <div className='flex-1 space-y-1'>
          <input
            type='range'
            min='0'
            max='100'
            value={progress}
            onChange={handleSeek}
            className='bg-secondary accent-primary h-2 w-full cursor-pointer appearance-none rounded-lg'
            disabled={loading}
          />

          <div className='text-muted-foreground flex justify-between text-xs'>
            <span>{formatTime(currentTime)}</span>
            <span>{loading ? '--:--' : formatTime(duration)}</span>
          </div>
        </div>

        <Button
          variant='ghost'
          size='icon'
          className='h-8 w-8'
          onClick={toggleMute}
          disabled={loading}
        >
          {isMuted ? (
            <VolumeX className='h-4 w-4' />
          ) : (
            <Volume2 className='h-4 w-4' />
          )}
        </Button>
      </div>
    </div>
  );
};

export default AudioPlayer;
