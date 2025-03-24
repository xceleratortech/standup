'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { createMeeting, getWorkspaceMembers } from '@/lib/actions/meeting';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';

interface CreateMeetingButtonProps {
  workspaceId: string;
  inline?: boolean;
  onMeetingCreated?: (meeting: any) => void;
  autoOpenDialog?: boolean;
  onDialogClose?: () => void;
}

export default function CreateMeetingButton({
  workspaceId,
  inline,
  onMeetingCreated,
  autoOpenDialog,
  onDialogClose,
}: CreateMeetingButtonProps) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(autoOpenDialog || false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  // Load workspace members when dialog opens
  useEffect(() => {
    async function loadWorkspaceMembers() {
      if (isDialogOpen && workspaceId) {
        try {
          setIsLoadingMembers(true);
          const workspaceMembers = await getWorkspaceMembers(workspaceId);
          setMembers(workspaceMembers);

          // Auto-select current user
          const currentUser = workspaceMembers.find((member) => member.isCurrentUser);
          if (currentUser) {
            setSelectedParticipants([currentUser.userId]);
          }
        } catch (error) {
          console.error('Failed to load workspace members:', error);
          toast.error('Failed to load workspace members');
        } finally {
          setIsLoadingMembers(false);
        }
      }
    }

    loadWorkspaceMembers();
  }, [isDialogOpen, workspaceId]);

  const handleCreateMeeting = async () => {
    if (!title.trim()) {
      toast.error('Please enter a meeting title');
      return;
    }

    try {
      setIsCreating(true);
      const newMeeting = await createMeeting({
        workspaceId,
        title: title.trim(),
        description: description.trim() || undefined,
        participantIds: selectedParticipants.length > 0 ? selectedParticipants : undefined,
      });

      setIsDialogOpen(false);
      if (onMeetingCreated) {
        onMeetingCreated(newMeeting);
      } else {
        router.refresh();
        toast.success('Meeting created successfully');
        router.push(`/workspace/${workspaceId}/meeting/${newMeeting.id}`);
      }
    } catch (error) {
      console.error('Error creating meeting:', error);
      toast.error('Failed to create meeting');
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    if (!isDialogOpen && onDialogClose) {
      onDialogClose();
    }
  }, [isDialogOpen, onDialogClose]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSelectedParticipants([]);
  };

  const renderMemberItem = (member: any) => (
    <div key={member.userId} className="flex items-center space-x-2">
      <Checkbox
        id={`member-${member.userId}`}
        checked={selectedParticipants.includes(member.userId)}
        onCheckedChange={(checked) => {
          if (checked) {
            setSelectedParticipants([...selectedParticipants, member.userId]);
          } else {
            // Don't allow deselecting self
            if (member.isCurrentUser) {
              return;
            }
            setSelectedParticipants(selectedParticipants.filter((id) => id !== member.userId));
          }
        }}
        disabled={member.isCurrentUser} // Disable checkbox for current user
      />
      <Label htmlFor={`member-${member.userId}`} className="flex-1 cursor-pointer text-sm">
        <div className="flex flex-col">
          <span className="font-medium">
            {member.user.name || member.user.email}
            {member.isCurrentUser && (
              <span className="text-muted-foreground ml-1 text-xs">(You)</span>
            )}
          </span>
          <span className="text-muted-foreground text-xs">
            {member.user.email}
            {member.role !== 'member' && <span className="ml-1">• {member.role}</span>}
          </span>
        </div>
      </Label>
    </div>
  );

  const renderParticipantsSection = () => (
    <div className="space-y-2">
      <Label>Participants</Label>
      {isLoadingMembers ? (
        <div className="flex items-center justify-center py-4">
          <Spinner size="sm" />
          <span className="text-muted-foreground ml-2 text-sm">Loading members...</span>
        </div>
      ) : members.length === 0 ? (
        <p className="text-muted-foreground text-sm">No workspace members found</p>
      ) : (
        <ScrollArea className="h-[200px] rounded-md border p-2">
          <div className="space-y-2">{members.map(renderMemberItem)}</div>
        </ScrollArea>
      )}
      <p className="text-muted-foreground text-xs">
        You will be automatically added as a participant.
      </p>
    </div>
  );

  if (inline) {
    return (
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="meeting-title">Meeting Title *</Label>
          <Input
            id="meeting-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter meeting title"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="meeting-description">Description (Optional)</Label>
          <Textarea
            id="meeting-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter meeting description"
            rows={3}
          />
        </div>

        {renderParticipantsSection()}
      </div>
    );
  }

  return (
    <>
      <Button onClick={() => setIsDialogOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        New Meeting
      </Button>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Meeting</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="meeting-title">Meeting Title *</Label>
              <Input
                id="meeting-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter meeting title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="meeting-description">Description (Optional)</Label>
              <Textarea
                id="meeting-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter meeting description"
                rows={3}
              />
            </div>

            {renderParticipantsSection()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={handleCreateMeeting} disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Meeting'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
