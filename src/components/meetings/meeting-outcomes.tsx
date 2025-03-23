'use client';

import {
  ListChecks,
  Plus,
  FileText,
  CheckCircle,
  Edit,
  Trash2,
  ExternalLink,
  UserCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  useMeetingOutcomes,
  useDeleteOutcome,
  useGenerateOutcome,
  useUpdateOutcome,
  useMeetingParticipants,
} from '@/lib/hooks/use-queries';
import { Spinner } from '@/components/ui/spinner';
import { useEffect, useState } from 'react';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { LoadingButton } from '@/components/ui/loading-button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface MeetingOutcomesProps {
  meetingId: string;
  canEdit: boolean;
  initialOutcomes?: any[];
  currentUserId?: string;
}

export default function MeetingOutcomes({
  meetingId,
  canEdit,
  initialOutcomes = [],
  currentUserId = '',
}: MeetingOutcomesProps) {
  const { data: outcomes = initialOutcomes, isLoading } = useMeetingOutcomes(meetingId);
  const { data: participants = [], isLoading: isLoadingParticipants } =
    useMeetingParticipants(meetingId);
  const { mutate: deleteOutcome, isPending: isDeleting } = useDeleteOutcome();
  const { mutate: updateOutcome, isPending: isUpdating } = useUpdateOutcome();
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [outcomeType, setOutcomeType] = useState<'summary' | 'actions'>('summary');
  const [additionalPrompt, setAdditionalPrompt] = useState('');

  // Initialize focusParticipant state after participants are loaded
  const [focusParticipant, setFocusParticipant] = useState<string | null>(null);

  // Set current user as focus participant when participants data loads
  useEffect(() => {
    if (!isLoadingParticipants && participants.length > 0 && currentUserId) {
      const isUserParticipant = participants.some((p) => p.userId === currentUserId);
      if (isUserParticipant) {
        setFocusParticipant(currentUserId);
      }
    }
  }, [participants, currentUserId, isLoadingParticipants]);

  const [editingOutcome, setEditingOutcome] = useState<any>(null);
  const [editContent, setEditContent] = useState('');
  const [editType, setEditType] = useState('');

  const {
    mutate: generateOutcome,
    isPending: isGenerating,
    error: generationError,
  } = useGenerateOutcome(meetingId);

  const getIconForType = (type: string) => {
    switch (type.toLowerCase()) {
      case 'summary':
        return <FileText className="h-4 w-4" />;
      case 'action items':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <ListChecks className="h-4 w-4" />;
    }
  };

  const handleGenerate = () => {
    generateOutcome(
      {
        outcomeType,
        additionalPrompt: additionalPrompt.trim() || undefined,
        focusParticipantId: focusParticipant === 'all' ? undefined : focusParticipant || undefined,
      },
      {
        onSuccess: () => {
          setShowGenerateDialog(false);
          setAdditionalPrompt('');
          setFocusParticipant(
            currentUserId && participants.some((p) => p.userId === currentUserId)
              ? currentUserId
              : null
          );
        },
      }
    );
  };

  const handleEdit = (outcome: any) => {
    setEditingOutcome(outcome);
    setEditContent(outcome.content);
    setEditType(outcome.type.toLowerCase() === 'action items' ? 'actions' : 'summary');
    setShowEditDialog(true);
  };

  const handleUpdateOutcome = () => {
    if (!editingOutcome) return;

    updateOutcome(
      {
        outcomeId: editingOutcome.id,
        content: editContent,
        type: editType === 'actions' ? 'Action Items' : 'Summary',
      },
      {
        onSuccess: () => {
          setShowEditDialog(false);
          setEditingOutcome(null);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  // Reset focus participant when the dialog is opened/closed
  const resetFocusParticipant = () => {
    // Check if current user is a participant
    const isUserParticipant = participants.some((p) => p.userId === currentUserId);
    setFocusParticipant(isUserParticipant ? currentUserId : null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <ListChecks className="h-5 w-5" />
          Outcomes
        </h2>
        {canEdit && (
          <Button size="sm" className="gap-1" onClick={() => setShowGenerateDialog(true)}>
            <Plus className="h-4 w-4" />
            Add Outcome
          </Button>
        )}
      </div>

      {outcomes.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center">
          <p>No outcomes have been added yet.</p>
          {canEdit && (
            <p className="mt-2 text-sm">
              Add a summary or action items from this meeting to keep track of important points.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {outcomes.map((outcome) => (
            <Card key={outcome.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <Badge variant="outline" className="flex items-center gap-1">
                    {getIconForType(outcome.type)}
                    <span className="capitalize">{outcome.type}</span>
                  </Badge>

                  {canEdit && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(outcome)}
                      >
                        <Edit className="text-muted-foreground h-4 w-4" />
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={isDeleting}
                          >
                            <Trash2 className="text-muted-foreground hover:text-destructive h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Outcome</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this outcome? This action cannot be
                              undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <LoadingButton
                              variant="destructive"
                              isLoading={isDeleting}
                              loadingText="Deleting..."
                              onClick={(e) => {
                                e.preventDefault();
                                deleteOutcome(outcome.id);
                              }}
                            >
                              Delete
                            </LoadingButton>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <MarkdownRenderer content={outcome.content} />
              </CardContent>
              <CardFooter className="text-muted-foreground pt-2 text-xs">
                Added{' '}
                {formatDistanceToNow(new Date(outcome.createdAt), {
                  addSuffix: true,
                })}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Generate Outcome Dialog */}
      <Dialog
        open={showGenerateDialog}
        onOpenChange={(open) => {
          if (!isGenerating) {
            setShowGenerateDialog(open);
            if (!open) {
              // Reset to defaults when closing
              resetFocusParticipant();
              setAdditionalPrompt('');
            }
          }
        }}
      >
        <DialogContent
          className="sm:max-w-md"
          onInteractOutside={(e) => {
            if (isGenerating) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (isGenerating) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Generate Outcome</DialogTitle>
            <DialogDescription>
              Generate a summary or action items from the meeting recordings that have
              transcriptions.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="outcome-type">Outcome Type</Label>
              <Select
                disabled={isGenerating}
                value={outcomeType}
                onValueChange={(value) => setOutcomeType(value as 'summary' | 'actions')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">Summary</SelectItem>
                  <SelectItem value="actions">Action Items</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Focus Participant Selector */}
            <div className="grid gap-2">
              <Label htmlFor="focus-participant">Focus On Participant</Label>
              <Select
                disabled={isGenerating || isLoadingParticipants}
                value={focusParticipant || 'all'}
                onValueChange={(value) => setFocusParticipant(value === 'all' ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All participants">
                    {isLoadingParticipants ? (
                      <div className="flex items-center gap-2">
                        <Spinner size="sm" />
                        <span>Loading participants...</span>
                      </div>
                    ) : focusParticipant ? (
                      <div className="flex items-center gap-2">
                        {/* Add avatar for selected participant */}
                        <Avatar className="h-5 w-5">
                          <AvatarImage
                            src={
                              participants.find((p) => p.userId === focusParticipant)?.image ||
                              undefined
                            }
                          />
                          <AvatarFallback>
                            {participants.find((p) => p.userId === focusParticipant)?.name?.[0] ||
                              '?'}
                          </AvatarFallback>
                        </Avatar>
                        <span>
                          {participants.find((p) => p.userId === focusParticipant)?.name ||
                            'Selected participant'}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <UserCircle2 className="text-muted-foreground h-4 w-4" />
                        <span>All participants</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <UserCircle2 className="text-muted-foreground h-4 w-4" />
                      <span>All participants</span>
                    </div>
                  </SelectItem>
                  {participants.map((participant) => (
                    <SelectItem key={participant.userId} value={participant.userId}>
                      {/* Updated layout for participant item */}
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={participant.image || undefined} />
                          <AvatarFallback>
                            {participant.name?.[0] || participant.email?.[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span>
                            {participant.name || 'Unknown User'}
                            {participant.userId === currentUserId && ' (You)'}
                          </span>
                          {participant.email && (
                            <span className="text-muted-foreground text-xs">
                              {participant.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isLoadingParticipants ? (
                <p className="text-muted-foreground text-xs">Loading participants...</p>
              ) : (
                <p className="text-muted-foreground text-xs">
                  {focusParticipant
                    ? 'The AI will focus on content relevant to the selected participant.'
                    : 'No focus selected. The AI will analyze content from all participants equally.'}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="additional-prompt">Additional Instructions (Optional)</Label>
              <Textarea
                id="additional-prompt"
                disabled={isGenerating}
                placeholder="E.g., Focus on technical decisions, highlight the main points..."
                value={additionalPrompt}
                onChange={(e) => setAdditionalPrompt(e.target.value)}
                className="resize-y"
                rows={3}
              />
            </div>

            {isGenerating && (
              <div className="bg-muted rounded-lg p-4 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <Spinner size="sm" />
                  Generating {outcomeType}...
                </div>
                <p className="text-muted-foreground mt-2">
                  This may take a minute or two. You can open this meeting in a new tab and come
                  back later.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 gap-1"
                  onClick={() => {
                    const pathParts = window.location.pathname.split('/');
                    const workspaceId = pathParts[2]; // Extract workspace ID from URL
                    window.open(`/workspace/${workspaceId}/meeting/${meetingId}`, '_blank');
                  }}
                >
                  <ExternalLink className="h-3 w-3" />
                  Open in new tab
                </Button>
              </div>
            )}

            {generationError && (
              <div className="text-destructive text-sm">
                {typeof generationError === 'object' && 'message' in generationError
                  ? (generationError as Error).message
                  : 'Failed to generate outcome. Make sure there are recordings with transcriptions.'}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowGenerateDialog(false)}
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Generating...
                </>
              ) : (
                'Generate'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Outcome Dialog */}
      <Dialog
        open={showEditDialog}
        onOpenChange={(open) => {
          if (!isUpdating) setShowEditDialog(open);
        }}
      >
        <DialogContent
          className="sm:max-w-md"
          onInteractOutside={(e) => {
            if (isUpdating) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (isUpdating) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit Outcome</DialogTitle>
            <DialogDescription>Update the content or type of this outcome.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-outcome-type">Outcome Type</Label>
              <Select
                disabled={isUpdating}
                value={editType}
                onValueChange={(value) => setEditType(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">Summary</SelectItem>
                  <SelectItem value="actions">Action Items</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-content">Content</Label>
              <Textarea
                id="edit-content"
                disabled={isUpdating}
                placeholder="Enter the outcome content..."
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="resize-y"
                rows={10}
              />
              <p className="text-muted-foreground text-xs">Markdown formatting is supported.</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateOutcome} disabled={isUpdating}>
              {isUpdating ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Updating...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
