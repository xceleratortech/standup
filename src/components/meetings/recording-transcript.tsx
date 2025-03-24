'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pencil } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranscriptSpeakers } from '@/lib/hooks/use-queries';
import { TranscriptSpeakerLabel } from './transcript-speaker';

interface TranscriptSegment {
  timestamp: string;
  text: string;
  speaker?: string;
}

interface RecordingTranscriptProps {
  transcription: string;
  audioUrl: string | null;
  meetingId: string;
  onPlaySegment?: (timeInSeconds: number) => void;
  currentPlaybackTime?: number; // Track current audio position
  canEdit?: boolean;
  onEditSegment?: (segmentIndex: number) => void; // Add callback for editing a segment
}

export default function RecordingTranscript({
  transcription,
  audioUrl,
  meetingId,
  onPlaySegment,
  currentPlaybackTime = 0,
  canEdit = false,
  onEditSegment,
}: RecordingTranscriptProps) {
  const [parsedTranscript, setParsedTranscript] = useState<TranscriptSegment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const lastScrolledSegmentRef = useRef<number>(-1);
  const shouldScrollRef = useRef<boolean>(true);

  // Get the speaker information from the hook
  const speakerMap = useTranscriptSpeakers(meetingId, transcription);

  useEffect(() => {
    try {
      // Try to parse the transcription JSON
      const parsed = JSON.parse(transcription) as any;

      // Check if the parsed result is an array
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Direct array format
        setParsedTranscript(parsed);
        setError(null);
      }
      // Check if the parsed result is an object with a segments array property
      else if (parsed && Array.isArray(parsed.segments) && parsed.segments.length > 0) {
        // Object with segments array format
        setParsedTranscript(parsed.segments);
        setError(null);
      } else {
        setError('Invalid transcript format');
      }
    } catch (e) {
      console.error('Failed to parse transcript:', e);
      setError('Could not parse transcript data');
    }
  }, [transcription]);

  // Convert timestamp string (like "00:30") to seconds number
  const timestampToSeconds = (timestamp: string): number => {
    try {
      // Handle different timestamp formats
      if (timestamp.includes(':')) {
        const parts = timestamp.split(':');
        if (parts.length === 2) {
          // Format: "MM:SS"
          return parseInt(parts[0]) * 60 + parseInt(parts[1]);
        } else if (parts.length === 3) {
          // Format: "HH:MM:SS"
          return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
        }
      }

      // Try to parse as a number (seconds)
      return parseInt(timestamp);
    } catch {
      return 0;
    }
  };

  // Scroll to current segment less frequently to improve performance
  useEffect(() => {
    if (currentPlaybackTime <= 0 || !parsedTranscript.length || !shouldScrollRef.current) return;

    // Find current segment
    let currentSegmentIndex = -1;
    for (let i = 0; i < parsedTranscript.length; i++) {
      const segmentTime = timestampToSeconds(parsedTranscript[i].timestamp);
      const nextSegmentTime =
        i < parsedTranscript.length - 1
          ? timestampToSeconds(parsedTranscript[i + 1].timestamp)
          : Number.MAX_SAFE_INTEGER;

      if (currentPlaybackTime >= segmentTime && currentPlaybackTime < nextSegmentTime) {
        currentSegmentIndex = i;
        break;
      }
    }

    // Only scroll if we found a segment and it's different from the last one we scrolled to
    if (currentSegmentIndex >= 0 && currentSegmentIndex !== lastScrolledSegmentRef.current) {
      lastScrolledSegmentRef.current = currentSegmentIndex;

      const segmentElement = segmentRefs.current.get(currentSegmentIndex);
      if (segmentElement && scrollAreaRef.current) {
        // Use a less resource-intensive scrolling method
        segmentElement.scrollIntoView({
          behavior: 'auto', // Changed from 'smooth' to reduce performance impact
          block: 'nearest', // Changed from 'center' to be less jerky
        });
      }
    }
  }, [currentPlaybackTime, parsedTranscript]);

  // Let user manually scroll without interruption
  const handleScroll = () => {
    shouldScrollRef.current = false;

    // @ts-expect-error - API inconsistency in return type needs flexibility
    clearTimeout(window.autoscrollTimeout as any);
    // @ts-expect-error - API inconsistency in return type needs flexibility
    window.autoscrollTimeout = setTimeout(() => {
      shouldScrollRef.current = true;
    }, 5000);
  };

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  if (parsedTranscript.length === 0) {
    return <div className="text-muted-foreground p-4">No transcript data available.</div>;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Transcript</h3>

      <ScrollArea
        className="h-64 rounded-md border"
        onScrollCapture={handleScroll}
        ref={scrollAreaRef}
      >
        <div className="space-y-3 p-4">
          {parsedTranscript.map((segment, index) => {
            // Calculate if this is the "current" segment based on playback time
            const segmentTime = timestampToSeconds(segment.timestamp);
            const nextSegmentTime =
              index < parsedTranscript.length - 1
                ? timestampToSeconds(parsedTranscript[index + 1].timestamp)
                : Number.MAX_SAFE_INTEGER;
            const isCurrentSegment =
              currentPlaybackTime >= segmentTime && currentPlaybackTime < nextSegmentTime;

            return (
              <div
                key={index}
                className={`group flex gap-2 ${isCurrentSegment ? 'bg-accent/40 -mx-2 rounded-md px-2 py-1' : ''}`}
                ref={(el) => {
                  if (el) segmentRefs.current.set(index, el);
                  else segmentRefs.current.delete(index);
                }}
              >
                <div className="text-muted-foreground w-16 flex-shrink-0 pt-1 text-xs">
                  {segment.timestamp}
                </div>

                <div className="flex gap-1">
                  {onPlaySegment && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => onPlaySegment(timestampToSeconds(segment.timestamp))}
                      disabled={!audioUrl}
                      aria-label={`Play from ${segment.timestamp}`}
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  )}

                  {canEdit && onEditSegment && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => onEditSegment(index)}
                      aria-label={`Edit segment at ${segment.timestamp}`}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                <div className="flex-1">
                  {segment.speaker && (
                    <div className="mb-1">
                      <TranscriptSpeakerLabel
                        speaker={segment.speaker}
                        speakerMap={speakerMap}
                        size="sm"
                      />
                    </div>
                  )}
                  <div className="text-sm">{segment.text}</div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
