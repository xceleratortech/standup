'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
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
import { deleteMeeting } from '@/lib/actions/meeting';
import { toast } from 'sonner';

interface DeleteMeetingDialogProps {
  meetingId: string;
  workspaceId: string;
}

export function DeleteMeetingDialog({ meetingId, workspaceId }: DeleteMeetingDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    try {
      router.prefetch(`/workspace/${workspaceId}`);
      setIsDeleting(true);
      await deleteMeeting(meetingId);
      toast.success('Meeting deleted successfully');
      setIsOpen(false);
      // Redirect to workspace page after deletion
      router.push(`/workspace/${workspaceId}`);
    } catch (error) {
      console.error('Error deleting meeting:', error);
      toast.error('Failed to delete meeting');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Meeting</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this meeting? This action cannot be undone. All
            recordings, outcomes, and meeting data will be permanently removed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete Meeting'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
