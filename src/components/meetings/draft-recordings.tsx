'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Trash2, PlusCircle, FileAudio, Pause } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addMeetingRecording, getRecordingUploadUrl } from '@/lib/actions/meeting-recordings';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '../ui/skeleton';
import { useDraftRecordings } from '@/contexts/draft-recordings-context';

interface DraftRecordingsProps {
  meetingId: string;
  canEdit: boolean;
}

export default function DraftRecordings({ meetingId, canEdit }: DraftRecordingsProps) {
  const { draftRecordings, deleteDraftRecording } = useDraftRecordings();
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<string | null>(null);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [selectedDraft, setSelectedDraft] = useState<any>(null);
  const [isAddingToMeeting, setIsAddingToMeeting] = useState(false);
  const [recordingName, setRecordingName] = useState('');

  useEffect(() => {
    // Short timeout to allow for initial loading
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  // Handle playing audio
  useEffect(() => {
    if (playing) {
      const draft = draftRecordings.find((r) => r.id === playing);
      if (draft) {
        const audioUrl = URL.createObjectURL(draft.blob);
        const newAudio = new Audio(audioUrl);
        newAudio.onended = () => setPlaying(null);
        newAudio.play();
        setAudio(newAudio);

        return () => {
          newAudio.pause();
          URL.revokeObjectURL(audioUrl);
        };
      }
    } else if (audio) {
      audio.pause();
      setAudio(null);
    }
  }, [playing, draftRecordings]);

  // Format seconds to readable time
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Toggle play/pause for a recording
  const togglePlay = (id: string) => {
    if (playing === id) {
      setPlaying(null);
    } else {
      if (playing) {
        // Stop any currently playing audio first
        setPlaying(null);
        setTimeout(() => setPlaying(id), 50);
      } else {
        setPlaying(id);
      }
    }
  };

  // Prepare to add a recording to the meeting
  const prepareAddToMeeting = (draft: any) => {
    setSelectedDraft(draft);
    setRecordingName(draft.name);
    setIsAddingToMeeting(true);
  };

  // Add the draft to the meeting
  const addToMeeting = async () => {
    if (!selectedDraft) return;

    try {
      setIsAddingToMeeting(false);
      toast.loading('Adding recording to meeting...');

      // Generate a filename
      const filename = `recording-${Date.now()}.mp3`;

      // Get a signed upload URL
      const urlRes = await getRecordingUploadUrl({
        meetingId,
        fileName: filename,
        contentType: selectedDraft.blob.type,
      });

      if (!urlRes.data) {
        throw new Error('Failed to get upload URL');
      }

      const uploadUrl = urlRes.data?.uploadUrl;
      const fileKey = urlRes.data?.fileKey;

      // Upload the file
      await fetch(uploadUrl, {
        method: 'PUT',
        body: selectedDraft.blob,
        headers: {
          'Content-Type': selectedDraft.blob.type,
        },
      });

      // Add the recording to the meeting
      await addMeetingRecording({
        meetingId,
        fileKey,
        recordingName: recordingName,
        duration: selectedDraft.duration.toString(),
      });

      // Remove from drafts after successful addition
      await deleteDraftRecording(selectedDraft.id);

      toast.dismiss();
      toast.success('Recording added to meeting');
    } catch (error) {
      console.error('Failed to add recording to meeting:', error);
      toast.dismiss();
      toast.error('Failed to add recording to meeting');
    }
  };

  // Delete a draft recording
  const deleteDraft = (id: string) => {
    try {
      deleteDraftRecording(id);
      if (playing === id) {
        setPlaying(null);
      }
      toast.success('Draft recording deleted');
    } catch (error) {
      console.error('Failed to delete draft recording:', error);
      toast.error('Failed to delete recording');
    }
  };

  if (!canEdit) return null;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Draft Recordings</CardTitle>
          <CardDescription>Loading your unsaved recordings...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (draftRecordings.length === 0) {
    return null; // Don't show the section if there are no drafts
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileAudio className="h-5 w-5" />
            Draft Recordings
          </CardTitle>
          <CardDescription>Unsaved recordings you can add to this meeting</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="space-y-3">
            {draftRecordings.map((draft) => (
              <div
                key={draft.id}
                className="hover:bg-accent/50 flex items-center justify-between rounded-md border p-2"
              >
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => togglePlay(draft.id)}>
                    {playing === draft.id ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>

                  <div>
                    <p className="font-medium">{draft.name}</p>
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <span>{formatDuration(draft.duration)}</span>
                      <span>•</span>
                      <span>
                        {formatDistanceToNow(new Date(draft.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => prepareAddToMeeting(draft)}>
                    <PlusCircle className="mr-1 h-4 w-4" />
                    Add to Meeting
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteDraft(draft.id)}>
                    <Trash2 className="text-destructive h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dialog for adding recording to meeting */}
      <Dialog open={isAddingToMeeting} onOpenChange={setIsAddingToMeeting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Recording to Meeting</DialogTitle>
            <DialogDescription>
              This recording will be uploaded and added to the current meeting.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label htmlFor="recording-name">Recording Name</Label>
            <Input
              id="recording-name"
              value={recordingName}
              onChange={(e) => setRecordingName(e.target.value)}
              placeholder="Enter a name for this recording"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingToMeeting(false)}>
              Cancel
            </Button>
            <Button onClick={addToMeeting}>Add to Meeting</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
