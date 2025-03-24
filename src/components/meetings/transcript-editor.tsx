'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import {
  useUpdateRecordingTranscriptionJson,
  useMeetingParticipants,
} from '@/lib/hooks/use-queries';
import { Transcript, TranscriptSegment } from '@/lib/actions/meeting-recordings';
import { Plus, Trash2, Save, RefreshCw, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface TranscriptEditorProps {
  meetingId: string;
  recordingId: string;
  transcription: string | null;
  onClose: () => void;
  highlightedSegmentIndex?: number; // Add prop for the segment to highlight
}

// Define TranscriptSegment for array format
interface SimpleTranscriptSegment {
  timestamp: string;
  speaker: string;
  text: string;
  startTimeSeconds?: number;
}

export default function TranscriptEditor({
  meetingId,
  recordingId,
  transcription,
  onClose,
  highlightedSegmentIndex,
}: TranscriptEditorProps) {
  const [segments, setSegments] = useState<SimpleTranscriptSegment[]>([]);
  const [isValid, setIsValid] = useState(true);
  const { mutate: updateTranscription, isPending } = useUpdateRecordingTranscriptionJson(meetingId);
  const { data: participants = [] } = useMeetingParticipants(meetingId);
  const segmentRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Pulse animation state
  const [pulsedSegment, setPulsedSegment] = useState<number | null>(null);

  // New participant dialog state
  const [newParticipantOpen, setNewParticipantOpen] = useState(false);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [newParticipantEmail, setNewParticipantEmail] = useState('');

  // Parse the transcription string into segments
  useEffect(() => {
    if (transcription) {
      try {
        // Try to parse as array of segments first
        const parsed = JSON.parse(transcription);

        if (Array.isArray(parsed)) {
          // Direct array format
          setSegments(parsed);
          setIsValid(true);
        } else if (parsed && Array.isArray(parsed.segments)) {
          // Object with segments array format
          setSegments(parsed.segments);
          setIsValid(true);
        } else {
          setSegments([]);
          setIsValid(false);
          toast.error('Invalid transcript format');
        }
      } catch (error) {
        console.error('Error parsing transcript:', error);
        setSegments([]);
        setIsValid(false);
        toast.error('Failed to parse transcript JSON');
      }
    } else {
      setSegments([]);
    }
  }, [transcription]);

  // Scroll to and highlight the specified segment when component mounts
  useEffect(() => {
    if (highlightedSegmentIndex !== undefined && segments.length > 0) {
      // Wait for segments to be rendered
      setTimeout(() => {
        const segmentElement = segmentRefs.current.get(highlightedSegmentIndex);
        if (segmentElement && scrollAreaRef.current) {
          segmentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

          // Trigger pulse animation
          setPulsedSegment(highlightedSegmentIndex);

          // Reset pulse after animation completes
          setTimeout(() => {
            setPulsedSegment(null);
          }, 2000);
        }
      }, 100);
    }
  }, [highlightedSegmentIndex, segments.length]);

  // Update a segment
  const updateSegment = (index: number, field: keyof SimpleTranscriptSegment, value: string) => {
    const newSegments = [...segments];

    // Update the specified field
    newSegments[index] = {
      ...newSegments[index],
      [field]: value,
    };

    // If updating timestamp, also update startTimeSeconds if possible
    if (field === 'timestamp') {
      const startTimeSeconds = parseTimestampToSeconds(value);
      if (!isNaN(startTimeSeconds)) {
        newSegments[index].startTimeSeconds = startTimeSeconds;
      }
    }

    setSegments(newSegments);
  };

  // Parse timestamp (e.g., "00:01:30") to seconds
  const parseTimestampToSeconds = (timestamp: string): number => {
    const parts = timestamp.split(':').map(Number);

    if (parts.length === 3) {
      // Format: HH:MM:SS
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      // Format: MM:SS
      return parts[0] * 60 + parts[1];
    }

    return NaN;
  };

  // Add a new segment
  const addSegment = () => {
    const newSegment: SimpleTranscriptSegment = {
      speaker: 'Person 1',
      text: '',
      timestamp: '00:00:00',
      startTimeSeconds: 0,
    };

    setSegments([...segments, newSegment]);
  };

  // Remove a segment
  const removeSegment = (index: number) => {
    const newSegments = [...segments];
    newSegments.splice(index, 1);
    setSegments(newSegments);
  };

  // Handle assigning a participant to a segment
  const assignParticipant = (index: number, participantIdentifier: string) => {
    updateSegment(index, 'speaker', participantIdentifier);
  };

  // Add a new custom participant
  const addCustomParticipant = () => {
    if (!newParticipantName.trim() || !newParticipantEmail.trim()) {
      toast.error('Name and email are required');
      return;
    }

    if (!isValidEmail(newParticipantEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    // Close dialog and reset form
    setNewParticipantOpen(false);

    // Use the email as the speaker identifier (consistent with AI-generated format)
    toast.success(`Added ${newParticipantName} as a speaker`);

    // Reset form
    setNewParticipantName('');
    setNewParticipantEmail('');
  };

  // Validate email format
  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Save the transcript
  const handleSave = () => {
    if (segments.length === 0) {
      toast.error('Cannot save an empty transcript');
      return;
    }

    // Always format as a Transcript object with segments property
    // to match the expected Transcript type
    const transcript: Transcript = { segments };

    updateTranscription({ recordingId, transcript }, { onSuccess: onClose });
  };

  // Sort segments by timestamp
  const sortSegments = () => {
    const sorted = [...segments].sort((a, b) => {
      const timeA = parseTimestampToSeconds(a.timestamp) || 0;
      const timeB = parseTimestampToSeconds(b.timestamp) || 0;
      return timeA - timeB;
    });

    setSegments(sorted);
    toast.success('Segments sorted by timestamp');
  };

  // Get speaker name for display
  const getSpeakerDisplayName = (speakerIdentifier: string) => {
    // If it's an email, try to find the participant
    if (speakerIdentifier.includes('@')) {
      const participant = participants.find(
        (p) => p.email?.toLowerCase() === speakerIdentifier.toLowerCase()
      );
      return participant ? `${participant.name} (${participant.email})` : speakerIdentifier;
    }
    return speakerIdentifier;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Edit Transcript</CardTitle>
      </CardHeader>

      <CardContent>
        {!isValid ? (
          <div className="bg-destructive/10 text-destructive rounded-md p-4">
            Invalid transcript format. Please regenerate the transcript.
          </div>
        ) : (
          <>
            <div className="mb-4 flex justify-between">
              <div className="flex gap-2">
                <Button onClick={addSegment} size="sm">
                  <Plus className="mr-1 h-4 w-4" /> Add Segment
                </Button>

                <Dialog open={newParticipantOpen} onOpenChange={setNewParticipantOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <UserPlus className="mr-1 h-4 w-4" /> Add Speaker
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Custom Speaker</DialogTitle>
                      <DialogDescription>
                        Add a new speaker who will be available for all segments.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                          id="name"
                          value={newParticipantName}
                          onChange={(e) => setNewParticipantName(e.target.value)}
                          placeholder="John Doe"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={newParticipantEmail}
                          onChange={(e) => setNewParticipantEmail(e.target.value)}
                          placeholder="john@example.com"
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setNewParticipantOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={addCustomParticipant}>Add Speaker</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <Button onClick={sortSegments} size="sm" variant="outline">
                <RefreshCw className="mr-1 h-4 w-4" /> Sort by Time
              </Button>
            </div>

            <ScrollArea className="h-[60vh] rounded-2xl border" ref={scrollAreaRef}>
              <div className="space-y-2">
                {segments.map((segment, index) => (
                  <div
                    key={index}
                    className={cn(
                      'rounded-md p-2',
                      pulsedSegment === index && 'animate-pulse bg-yellow-100 dark:bg-yellow-900/30'
                    )}
                    ref={(el) => {
                      if (el) segmentRefs.current.set(index, el);
                      else segmentRefs.current.delete(index);
                    }}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="w-[130px] flex-shrink-0">
                        <Select
                          value={segment.speaker}
                          onValueChange={(value) => assignParticipant(index, value)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Speaker" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Person 1">Person 1</SelectItem>
                            <SelectItem value="Person 2">Person 2</SelectItem>
                            {participants.map((participant) => (
                              <SelectItem key={participant.userId} value={participant.email || ''}>
                                {participant.name} ({participant.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-2">
                        <Input
                          value={segment.timestamp}
                          onChange={(e) => updateSegment(index, 'timestamp', e.target.value)}
                          className="h-8 w-24 text-xs"
                          placeholder="00:00:00"
                        />

                        <Button
                          onClick={() => removeSegment(index)}
                          variant="ghost"
                          size="icon"
                          className="ml-auto h-6 w-6 flex-shrink-0"
                        >
                          <Trash2 className="text-destructive h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <Textarea
                      value={segment.text}
                      onChange={(e) => updateSegment(index, 'text', e.target.value)}
                      rows={2}
                      className="resize-none text-sm"
                    />
                  </div>
                ))}

                {segments.length === 0 && (
                  <div className="text-muted-foreground p-4 text-center">
                    No transcript segments. Add a segment to get started.
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isPending || !isValid || segments.length === 0}>
          {isPending ? (
            'Saving...'
          ) : (
            <>
              <Save className="mr-1 h-4 w-4" /> Save
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
