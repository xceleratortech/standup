'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Trash2, Play, Pause, Save, Plus, FileAudio, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  useDraftRecordings,
  DraftRecording,
  RecordingGroup,
} from '@/contexts/draft-recordings-context';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface SegmentedRecordingManagerProps {
  onAddToMeeting?: (recordings: DraftRecording[], groupName: string) => void;
}

export function SegmentedRecordingManager({ onAddToMeeting }: SegmentedRecordingManagerProps) {
  const { draftRecordings, recordingGroups, deleteRecordingGroup, getRecordingsByGroupId } =
    useDraftRecordings();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [newGroupName, setNewGroupName] = useState<string>('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);
  const [showAddToMeetingDialog, setShowAddToMeetingDialog] = useState(false);

  // Get segments for the selected group
  const groupSegments = selectedGroupId ? getRecordingsByGroupId(selectedGroupId) : [];

  // Get the selected group
  const selectedGroup = recordingGroups.find((g) => g.id === selectedGroupId);

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

  // Format duration
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Toggle play/pause for a segment
  const togglePlay = (id: string) => {
    if (playing === id) {
      setPlaying(null);
    } else {
      setPlaying(id);
    }
  };

  // Handle deleting a group
  const handleDeleteGroup = useCallback(async () => {
    if (!groupToDelete) return;

    try {
      await deleteRecordingGroup(groupToDelete);
      toast.success('Recording group deleted');
      setSelectedGroupId(null);
      setShowDeleteDialog(false);
      setGroupToDelete(null);
    } catch (error) {
      console.error('Failed to delete group:', error);
      toast.error('Failed to delete recording group');
    }
  }, [groupToDelete, deleteRecordingGroup]);

  // Handle adding to meeting
  const handleAddToMeeting = () => {
    if (!selectedGroupId || !onAddToMeeting) return;

    const segments = getRecordingsByGroupId(selectedGroupId);
    const groupName = newGroupName || selectedGroup?.name || 'Segmented Recording';

    onAddToMeeting(segments, groupName);
    setShowAddToMeetingDialog(false);
  };

  // Confirm group deletion
  const confirmDeleteGroup = (groupId: string) => {
    setGroupToDelete(groupId);
    setShowDeleteDialog(true);
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileAudio className="h-5 w-5" />
            Segmented Recordings
          </CardTitle>
          <CardDescription>Manage multi-part recordings</CardDescription>
        </CardHeader>

        <CardContent>
          {recordingGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="bg-muted/30 mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                <FileAudio className="text-muted-foreground h-8 w-8" />
              </div>
              <h3 className="font-medium">No segmented recordings</h3>
              <p className="text-muted-foreground mt-1 max-w-xs text-sm">
                Create multi-part recordings to organize longer content
              </p>
            </div>
          ) : (
            <div className="flex h-[400px] flex-col gap-4 md:flex-row">
              {/* Group list */}
              <div className="w-full border-b pb-4 md:w-1/3 md:border-r md:border-b-0 md:pr-4">
                <h3 className="mb-2 font-medium">Recording Groups</h3>
                <ScrollArea className="h-[340px] pr-3">
                  {recordingGroups.map((group) => (
                    <div
                      key={group.id}
                      className={cn(
                        'hover:bg-accent/50 mb-2 cursor-pointer rounded border p-2 transition-colors',
                        selectedGroupId === group.id && 'border-primary bg-accent'
                      )}
                      onClick={() => setSelectedGroupId(group.id)}
                    >
                      <div className="flex justify-between">
                        <div className="font-medium">{group.name}</div>
                        <Badge variant="outline">{formatTime(group.totalDuration)}</Badge>
                      </div>
                      <div className="text-muted-foreground mt-1 text-xs">
                        {group.segmentCount} {group.segmentCount === 1 ? 'segment' : 'segments'}
                      </div>
                    </div>
                  ))}
                </ScrollArea>
              </div>

              {/* Segment details */}
              <div className="w-full md:w-2/3 md:pl-4">
                {selectedGroupId ? (
                  <>
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-medium">{selectedGroup?.name || 'Segments'}</h3>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setNewGroupName(selectedGroup?.name || '');
                            setShowAddToMeetingDialog(true);
                          }}
                          disabled={groupSegments.length === 0}
                        >
                          <Save className="mr-1 h-4 w-4" />
                          Add to Meeting
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => confirmDeleteGroup(selectedGroupId)}
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>

                    <ScrollArea className="h-[300px] pr-3">
                      {groupSegments.map((segment, index) => (
                        <div key={segment.id} className="mb-3 rounded border p-3">
                          <div className="flex items-center gap-3">
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                'h-8 w-8 rounded-full',
                                playing === segment.id && 'bg-primary text-primary-foreground'
                              )}
                              onClick={() => togglePlay(segment.id)}
                            >
                              {playing === segment.id ? (
                                <Pause className="h-4 w-4" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>

                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">Segment {index + 1}</span>
                                <Badge variant="outline">
                                  {segment.formattedDuration || formatTime(segment.duration)}
                                </Badge>
                              </div>
                              <div className="text-muted-foreground text-xs">
                                Recorded {new Date(segment.createdAt).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </ScrollArea>
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center py-8 text-center">
                    <ArrowRight className="text-muted-foreground h-8 w-8" />
                    <p className="text-muted-foreground mt-2">
                      Select a recording group to view its segments
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Recording Group?</DialogTitle>
            <DialogDescription>
              This will permanently delete all segments in this recording group. This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteGroup}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to Meeting Dialog */}
      <Dialog open={showAddToMeetingDialog} onOpenChange={setShowAddToMeetingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Meeting</DialogTitle>
            <DialogDescription>Add this segmented recording to a meeting.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">Recording Name</Label>
              <Input
                id="group-name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Enter a name for this recording group"
              />
            </div>

            <div className="space-y-1">
              <Label>Segments</Label>
              <div className="rounded-md border p-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{groupSegments.length} segments</span>
                  <span className="text-sm">
                    Total duration: {formatTime(selectedGroup?.totalDuration || 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddToMeetingDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddToMeeting}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
