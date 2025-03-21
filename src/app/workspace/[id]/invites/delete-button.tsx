'use client';

import { useState } from 'react';
import { deleteWorkspaceInvite } from '@/lib/actions/workspace-members';
import { useRouter } from 'next/navigation';
import { LoadingButton } from '@/components/ui/loading-button';

export default function DeleteInviteButton({
  inviteId,
  workspaceId,
}: {
  inviteId: string;
  workspaceId: string;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this invite?')) {
      return;
    }

    setIsLoading(true);
    try {
      await deleteWorkspaceInvite(inviteId);
      router.refresh();
    } catch (error) {
      alert((error as Error).message || 'Failed to delete invite');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LoadingButton
      size='sm'
      variant='destructive'
      onClick={handleDelete}
      isLoading={isLoading}
      loadingText='Deleting...'
    >
      Delete
    </LoadingButton>
  );
}
