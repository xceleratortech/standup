'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateMemberRole, removeMember } from '@/lib/actions/workspace-members';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoadingButton } from '@/components/ui/loading-button';

export default function MemberActions({
  workspaceId,
  userId,
  currentRole,
}: {
  workspaceId: string;
  userId: string;
  currentRole: string;
}) {
  const [role, setRole] = useState(currentRole);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const router = useRouter();

  const handleRoleUpdate = async () => {
    if (role === currentRole) return;

    setIsUpdating(true);
    try {
      await updateMemberRole({
        workspaceId,
        userId,
        newRole: role,
      });
      router.refresh();
    } catch (error) {
      alert((error as Error).message || 'Failed to update role');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!confirm(`Are you sure you want to remove this member from the workspace?`)) {
      return;
    }

    setIsRemoving(true);
    try {
      router.prefetch(`/workspace/${workspaceId}`);
      await removeMember({
        workspaceId,
        userId,
      });
      router.push(`/workspace/${workspaceId}`);
    } catch (error) {
      alert((error as Error).message || 'Failed to remove member');
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Change Role</h3>
        <div className="flex gap-2">
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="member">Member</SelectItem>
            </SelectContent>
          </Select>
          <LoadingButton
            onClick={handleRoleUpdate}
            isLoading={isUpdating}
            loadingText="Updating..."
          >
            Update Role
          </LoadingButton>
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="mb-4 text-sm font-medium">Remove Member</h3>
        <LoadingButton
          variant="destructive"
          onClick={handleRemoveMember}
          isLoading={isRemoving}
          loadingText="Removing..."
        >
          Remove from Workspace
        </LoadingButton>
      </div>
    </div>
  );
}
