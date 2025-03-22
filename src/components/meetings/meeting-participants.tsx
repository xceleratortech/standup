'use client';

import { Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  useMeetingParticipants,
  useRemoveParticipant,
} from '@/lib/hooks/use-queries';
import { Spinner } from '@/components/ui/spinner';
import { AddParticipantDialog } from './add-participant-dialog';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';

interface Participant {
  userId: string;
  role: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface MeetingParticipantsProps {
  meetingId: string;
  workspaceId: string;
  canEdit: boolean;
  initialParticipants?: Participant[];
}

export default function MeetingParticipants({
  meetingId,
  workspaceId, // Keep this prop as it's used in AddParticipantDialog
  canEdit,
  initialParticipants = [],
}: MeetingParticipantsProps) {
  const queryClient = useQueryClient();
  const { data: participants = initialParticipants, isLoading } =
    useMeetingParticipants(meetingId);
  const { mutate: removeParticipant, isPending: isRemoving } =
    useRemoveParticipant();

  const refreshParticipants = () => {
    queryClient.invalidateQueries({ queryKey: ['participants', meetingId] });
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role.toLowerCase()) {
      case 'organizer':
        return 'default';
      case 'editor':
        return 'secondary';
      case 'commenter':
        return 'outline';
      default:
        return 'outline';
    }
  };

  if (isLoading) {
    return (
      <div className='space-y-4 rounded-lg border p-4'>
        <div className='flex items-center justify-between'>
          <h3 className='font-medium'>Participants</h3>
        </div>
        <div className='flex justify-center py-4'>
          <Spinner />
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-4 rounded-lg border p-4'>
      <div className='flex items-center justify-between'>
        <h3 className='font-medium'>Participants ({participants.length})</h3>
        {canEdit && (
          <AddParticipantDialog
            meetingId={meetingId}
            workspaceId={workspaceId}
            existingParticipantIds={participants.map((p) => p.userId)}
            onParticipantAdded={refreshParticipants}
          />
        )}
      </div>

      <div className='space-y-3'>
        {participants.length === 0 ? (
          <div className='text-muted-foreground rounded-md border border-dashed p-4 text-center text-sm'>
            No participants found
          </div>
        ) : (
          participants.map((participant) => (
            <div
              key={participant.userId}
              className='flex items-center justify-between'
            >
              <div className='flex items-center gap-2'>
                <Avatar className='h-8 w-8'>
                  <AvatarImage src={participant.image || undefined} />
                  <AvatarFallback>
                    {participant.name?.[0] || participant.email?.[0] || '?'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className='text-sm font-medium'>
                    {participant.name || participant.email || 'Unknown User'}
                  </p>
                  <Badge
                    variant={getRoleBadgeVariant(participant.role)}
                    className='mt-1 text-xs'
                  >
                    {participant.role}
                  </Badge>
                </div>
              </div>

              {canEdit && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-8 w-8'
                      disabled={isRemoving}
                    >
                      <Trash2 className='text-muted-foreground hover:text-destructive h-4 w-4' />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove Participant</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to remove this participant from
                        the meeting?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={(e) => {
                          e.preventDefault();
                          removeParticipant({
                            meetingId,
                            userId: participant.userId,
                          });
                        }}
                      >
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
