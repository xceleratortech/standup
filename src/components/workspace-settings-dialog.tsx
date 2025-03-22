'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Cog, MoreVertical, UserPlus, Settings } from 'lucide-react';
import { type InferSelectModel } from 'drizzle-orm';
import { workspace } from '@/lib/db/schema';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Workspace = InferSelectModel<typeof workspace>;

interface WorkspaceSettingsDialogProps {
  workspace: Workspace;
  members: any[];
  currentUserId: string;
}

function WorkspaceSettingsDialog({
  workspace,
  members,
  currentUserId,
}: WorkspaceSettingsDialogProps) {
  const router = useRouter();
  const [openAlert, setOpenAlert] = useState(false);
  const [selectedAction, setSelectedAction] = useState<{
    userId: string;
    action: 'promote' | 'demote' | 'remove';
    name: string;
  } | null>(null);

  const handleMemberAction = async () => {
    if (!selectedAction) return;

    // Here you would call your API endpoint to update the member's role
    // Similar to what you would do in MemberActions component
    try {
      const action = selectedAction.action;
      const endpoint = `/api/workspace/${workspace.id}/members/${selectedAction.userId}`;

      if (action === 'remove') {
        await fetch(endpoint, { method: 'DELETE' });
      } else {
        const newRole = action === 'promote' ? 'admin' : 'member';
        await fetch(endpoint, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: newRole }),
        });
      }

      router.refresh();
      setOpenAlert(false);
      setSelectedAction(null);
    } catch (error) {
      console.error('Failed to update member:', error);
    }
  };

  const getAlertContent = () => {
    if (!selectedAction) return null;

    const isCurrentUser = selectedAction.userId === currentUserId;
    const { action, name } = selectedAction;

    let title = '';
    let description = '';

    if (action === 'promote') {
      title = `Promote ${isCurrentUser ? 'Yourself' : name}`;
      description = `Are you sure you want to promote ${isCurrentUser ? 'yourself' : name} to admin? ${
        isCurrentUser ? 'You will' : 'They will'
      } have full control over this workspace.`;
    } else if (action === 'demote') {
      title = `Demote ${isCurrentUser ? 'Yourself' : name}`;
      description = `Are you sure you want to remove admin privileges from ${
        isCurrentUser ? 'yourself' : name
      }? ${isCurrentUser ? 'You will' : 'They will'} no longer be able to manage workspace settings.`;
    } else {
      title = `Remove ${isCurrentUser ? 'Yourself' : name}`;
      description = `Are you sure you want to remove ${
        isCurrentUser ? 'yourself' : name
      } from this workspace? ${
        isCurrentUser ? 'You will' : 'They will'
      } lose access to all content.`;
    }

    return { title, description };
  };

  const alertContent = getAlertContent();

  return (
    <>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon">
            <Cog className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[480px]">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="text-lg font-medium">Workspace Settings</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Manage your workspace and team members
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-y-auto px-6 py-2">
            {/* Workspace Info Section */}
            <div className="mb-6">
              <h3 className="text-muted-foreground mb-3 text-sm font-medium">
                WORKSPACE INFORMATION
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Name</span>
                  <span className="text-sm font-medium">{workspace.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Created</span>
                  <span className="text-sm">
                    {new Date(workspace.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Slug</span>
                  <span className="text-muted-foreground text-sm">{workspace.slug}</span>
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Team Members Section */}
            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-muted-foreground text-sm font-medium">MEMBERS</h3>
                <Badge variant="outline" className="h-5 rounded-full px-2 py-0 text-xs font-normal">
                  {members.length}
                </Badge>
              </div>

              <div className="space-y-1">
                {members.map((member) => {
                  const isCurrentUser = member.userId === currentUserId;
                  const isAdmin = member.role === 'admin';

                  return (
                    <div
                      key={member.userId}
                      className="hover:bg-secondary/50 flex items-center justify-between rounded-md p-2 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {(member.name || 'User').substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">
                            {member.name || 'Unnamed User'}
                            {isCurrentUser && (
                              <span className="text-muted-foreground ml-1 text-xs">(you)</span>
                            )}
                            {isAdmin && (
                              <span className="text-muted-foreground ml-1 text-xs">(admin)</span>
                            )}
                          </p>
                          <p className="text-muted-foreground text-xs">{member.email}</p>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {isAdmin ? (
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedAction({
                                  userId: member.userId,
                                  action: 'demote',
                                  name: member.name || 'Unnamed User',
                                });
                                setOpenAlert(true);
                              }}
                            >
                              Demote to Member
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedAction({
                                  userId: member.userId,
                                  action: 'promote',
                                  name: member.name || 'Unnamed User',
                                });
                                setOpenAlert(true);
                              }}
                            >
                              Promote to Admin
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuSeparator />

                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              setSelectedAction({
                                userId: member.userId,
                                action: 'remove',
                                name: member.name || 'Unnamed User',
                              });
                              setOpenAlert(true);
                            }}
                          >
                            Remove from Workspace
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Actions Section with sticky footer */}
          <div className="bg-background flex items-center justify-between border-t px-6 py-4">
            <Button asChild variant="outline" size="sm" className="h-8 text-xs">
              <Link href={`/workspace/${workspace.id}/invites`}>
                <UserPlus className="mr-1 h-3 w-3" />
                Invite Members
              </Link>
            </Button>
            <Button asChild size="sm" className="h-8 text-xs">
              <Link href={`/workspace/${workspace.id}/settings`}>
                <Settings className="mr-1 h-3 w-3" />
                Advanced Settings
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Alert Dialog */}
      {alertContent && (
        <AlertDialog open={openAlert} onOpenChange={setOpenAlert}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{alertContent.title}</AlertDialogTitle>
              <AlertDialogDescription>{alertContent.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleMemberAction}
                className={
                  selectedAction?.action === 'remove'
                    ? 'bg-destructive hover:bg-destructive/90'
                    : ''
                }
              >
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

export default WorkspaceSettingsDialog;
