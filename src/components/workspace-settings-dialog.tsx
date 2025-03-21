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
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Cog, UserCircle } from 'lucide-react';
import { type InferSelectModel } from 'drizzle-orm';
import { workspace } from '@/lib/db/schema';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

type Workspace = InferSelectModel<typeof workspace>;

interface WorkspaceSettingsDialogProps {
  workspace: Workspace;
  members: any[];
}

function WorkspaceSettingsDialog({
  workspace,
  members,
}: WorkspaceSettingsDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant='ghost' size='icon'>
          <Cog className='h-4 w-4' />
        </Button>
      </DialogTrigger>
      <DialogContent className='gap-0 overflow-hidden p-0 sm:max-w-[480px]'>
        <DialogHeader className='px-6 pt-6 pb-4'>
          <DialogTitle className='text-lg font-medium'>
            Workspace Settings
          </DialogTitle>
          <DialogDescription className='text-muted-foreground text-sm'>
            Manage your workspace and team members
          </DialogDescription>
        </DialogHeader>

        <div className='max-h-[70vh] overflow-y-auto px-6 py-2'>
          {/* Workspace Info Section */}
          <div className='mb-6'>
            <h3 className='text-muted-foreground mb-3 text-sm font-medium'>
              WORKSPACE INFORMATION
            </h3>
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <span className='text-sm'>Name</span>
                <span className='text-sm font-medium'>{workspace.name}</span>
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-sm'>Created</span>
                <span className='text-sm'>
                  {new Date(workspace.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-sm'>Slug</span>
                <span className='text-muted-foreground text-sm'>
                  {workspace.slug}
                </span>
              </div>
            </div>
          </div>

          <Separator className='my-4' />

          {/* Team Members Section */}
          <div className='mb-6'>
            <div className='mb-3 flex items-center justify-between'>
              <h3 className='text-muted-foreground text-sm font-medium'>
                MEMBERS
              </h3>
              <Badge
                variant='outline'
                className='h-5 rounded-full px-2 py-0 text-xs font-normal'
              >
                {members.length}
              </Badge>
            </div>

            <div className='space-y-1'>
              {members.map((member) => (
                <div
                  key={member.userId}
                  className='hover:bg-secondary/50 flex items-center justify-between rounded-md p-2 transition-colors'
                >
                  <div className='flex items-center gap-3'>
                    <Avatar className='h-8 w-8'>
                      <AvatarFallback className='text-xs'>
                        {(member.name || 'User').substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className='text-sm font-medium'>
                        {member.name || 'Unnamed User'}
                        {member.role === 'admin' && (
                          <span className='text-muted-foreground ml-1 text-xs'>
                            (admin)
                          </span>
                        )}
                      </p>
                      <p className='text-muted-foreground text-xs'>
                        {member.email}
                      </p>
                    </div>
                  </div>
                  <Button
                    asChild
                    size='sm'
                    variant='ghost'
                    className='hover:bg-secondary h-7 text-xs'
                  >
                    <Link
                      href={`/workspace/${workspace.id}/members/${member.userId}`}
                    >
                      Manage
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actions Section with sticky footer */}
        <div className='bg-background flex items-center justify-between border-t px-6 py-4'>
          <Button asChild variant='outline' size='sm' className='h-8 text-xs'>
            <Link href={`/workspace/${workspace.id}/invites`}>
              Invite Members
            </Link>
          </Button>
          <Button asChild size='sm' className='h-8 text-xs'>
            <Link href={`/workspace/${workspace.id}/settings`}>
              Advanced Settings
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default WorkspaceSettingsDialog;
