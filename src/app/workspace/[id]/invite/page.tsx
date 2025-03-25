'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { createWorkspaceInvite } from '@/lib/actions/workspace-members';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingButton } from '@/components/ui/loading-button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function InviteMemberPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [linkOnly, setLinkOnly] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      router.prefetch(`/workspace/${params.id}/invites`);
      const emailToSend = linkOnly ? undefined : email;
      const invite = await createWorkspaceInvite({
        workspaceId: params.id,
        email: emailToSend,
        role,
      });

      if (linkOnly && invite.data) {
        setInviteLink(invite.data.inviteUrl);
      } else {
        router.push(`/workspace/${params.id}/invites`);
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to create invite');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Invite Team Members</CardTitle>
          <CardDescription>Invite people to join your workspace</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="linkOnly"
                  checked={linkOnly}
                  onChange={(e) => setLinkOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="linkOnly" className="text-sm">
                  Generate invite link only (no email)
                </label>
              </div>

              {!linkOnly && (
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Email Address
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="colleague@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required={!linkOnly}
                  />
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="role" className="text-sm font-medium">
                  Role
                </label>
                <Select value={role} onValueChange={(value) => setRole(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {inviteLink && (
                <div className="rounded-md bg-blue-50 p-3">
                  <p className="text-sm font-medium text-blue-800">Invite link generated:</p>
                  <div className="mt-2 flex">
                    <Input value={inviteLink} readOnly className="text-xs" />
                    <Button
                      type="button"
                      variant="outline"
                      className="ml-2"
                      onClick={() => {
                        navigator.clipboard.writeText(inviteLink);
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-500">{error}</div>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onMouseDown={() => router.push(`/workspace/${params.id}`)}
              onMouseOver={() => router.prefetch(`/workspace/${params.id}`)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <LoadingButton
              type="submit"
              isLoading={isLoading}
              loadingText={linkOnly ? 'Generating...' : 'Sending...'}
            >
              {linkOnly ? 'Generate Link' : 'Send Invite'}
            </LoadingButton>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
