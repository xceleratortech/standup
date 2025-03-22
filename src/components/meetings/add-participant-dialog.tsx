'use client';

import { useState } from 'react';
import { UserPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useWorkspaceMembers } from '@/lib/hooks/use-queries';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { addMeetingParticipant } from '@/lib/actions/meeting-participants';
import { MEETING_ROLES } from '@/lib/db/schema';

interface AddParticipantDialogProps {
  meetingId: string;
  workspaceId: string;
  existingParticipantIds: string[];
  onParticipantAdded: () => void;
}

export function AddParticipantDialog({
  meetingId,
  workspaceId,
  existingParticipantIds,
  onParticipantAdded,
}: AddParticipantDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  // Fix the type error by using string instead of a specific enum value
  const [selectedRole, setSelectedRole] = useState<string>(
    MEETING_ROLES.VIEWER
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: members = [], isLoading } = useWorkspaceMembers(workspaceId);

  // Filter out members who are already participants
  const availableMembers = members.filter(
    (member) => !existingParticipantIds.includes(member.userId)
  );

  const handleAddParticipant = async () => {
    if (!selectedUserId) {
      toast.error('Please select a user');
      return;
    }

    setIsSubmitting(true);

    try {
      await addMeetingParticipant({
        meetingId,
        userId: selectedUserId,
        role: selectedRole,
      });

      toast.success('Participant added successfully');
      onParticipantAdded();
      setOpen(false);
      setSelectedUserId(null);
      setSelectedRole(MEETING_ROLES.VIEWER);
    } catch (error) {
      console.error('Failed to add participant:', error);
      toast.error('Failed to add participant');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size='sm' variant='outline' className='flex items-center gap-1'>
          <UserPlus className='h-3 w-3' />
          <span>Add</span>
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Add Participant</DialogTitle>
          <DialogDescription>
            Add a workspace member to this meeting
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-4'>
          <div className='space-y-2'>
            <div className='text-sm font-medium'>Select User</div>

            {isLoading ? (
              <div className='flex items-center justify-center py-4'>
                <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
              </div>
            ) : availableMembers.length === 0 ? (
              <div className='text-muted-foreground rounded-md border p-4 text-center text-sm'>
                All workspace members are already participants in this meeting.
              </div>
            ) : (
              <ScrollArea className='h-60 rounded-md border'>
                <div className='p-2'>
                  {availableMembers.map((member) => (
                    <div
                      key={member.userId}
                      className={`flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors ${
                        selectedUserId === member.userId
                          ? 'bg-secondary'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => setSelectedUserId(member.userId)}
                    >
                      <Avatar className='h-8 w-8'>
                        <AvatarImage src={member.image || undefined} />
                        <AvatarFallback>
                          {member.name?.[0] || member.email?.[0] || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className='flex-1 overflow-hidden'>
                        <p className='truncate font-medium'>
                          {member.name || 'Unnamed User'}
                        </p>
                        <p className='text-muted-foreground truncate text-xs'>
                          {member.email}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <div className='space-y-2'>
            <div className='text-sm font-medium'>Role</div>
            <Select
              value={selectedRole}
              onValueChange={setSelectedRole}
              disabled={isSubmitting}
            >
              <SelectTrigger className='w-full'>
                <SelectValue placeholder='Select role' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MEETING_ROLES.VIEWER}>Viewer</SelectItem>
                <SelectItem value={MEETING_ROLES.COMMENTER}>
                  Commenter
                </SelectItem>
                <SelectItem value={MEETING_ROLES.EDITOR}>Editor</SelectItem>
                <SelectItem value={MEETING_ROLES.ORGANIZER}>
                  Organizer
                </SelectItem>
              </SelectContent>
            </Select>
            <p className='text-muted-foreground text-xs'>
              {selectedRole === MEETING_ROLES.VIEWER
                ? 'Can view meeting content and recordings'
                : selectedRole === MEETING_ROLES.COMMENTER
                  ? 'Can view and comment on meeting content'
                  : selectedRole === MEETING_ROLES.EDITOR
                    ? 'Can edit meeting content and add recordings'
                    : 'Full control over the meeting'}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddParticipant}
            disabled={!selectedUserId || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Adding...
              </>
            ) : (
              'Add Participant'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
