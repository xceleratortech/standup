'use client';

import { useState } from 'react';
import { acceptWorkspaceInvite } from '@/lib/actions/workspace-members';
import { useRouter } from 'next/navigation';
import { LoadingButton } from '@/components/ui/loading-button';

export default function AcceptInviteButton({ token }: { token: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleAccept = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await acceptWorkspaceInvite(token);
      if (result.success) {
        router.push(`/workspace/${result.workspaceId}`);
      } else {
        setError(result.error || 'Failed to accept invitation');
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to accept invitation');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <LoadingButton
        className="w-full"
        onClick={handleAccept}
        isLoading={isLoading}
        loadingText="Joining..."
      >
        Accept Invitation
      </LoadingButton>

      {error && <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-500">{error}</div>}
    </>
  );
}
