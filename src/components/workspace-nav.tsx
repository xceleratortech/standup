import { getWorkspace, getUserWorkspaces, getUserVoiceIdentity } from '@/lib/actions/workspace';
import { getWorkspaceMembers } from '@/lib/actions/workspace-members';
import { WorkspaceSelector } from '@/components/workspace-selector';
import WorkspaceSettingsDialog from './workspace-settings-dialog';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import UserProfileMenu from './user-profile-menu';
import { ChevronRight, CassetteTape, Menu, Cog, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '@/components/ui/dialog';
import { Link } from './ui/link';

interface BreadcrumbItem {
  label: string;
  href: string;
  current?: boolean;
}

interface WorkspaceNavProps {
  workspaceId: string;
  breadcrumbs?: BreadcrumbItem[];
}

async function WorkspaceNav({ workspaceId, breadcrumbs }: WorkspaceNavProps) {
  // Server-side data fetching
  const userWorkspaces = await getUserWorkspaces();
  const workspaceData = await getWorkspace(workspaceId);
  const members = await getWorkspaceMembers(workspaceId);
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const voiceIdentities = await getUserVoiceIdentity({ workspaceId });

  // Ensure workspace has all required non-optional properties
  const workspace = {
    id: workspaceData.data?.id || '',
    name: workspaceData.data?.name || '',
    createdAt: workspaceData.data?.createdAt || new Date(),
    updatedAt: workspaceData.data?.updatedAt || new Date(),
    slug: workspaceData.data?.slug || '',
    creatorId: workspaceData.data?.creatorId || '',
  };

  // Sort workspaces by creation date (newest first)
  const sortedWorkspaces = [...(userWorkspaces.data || [])].sort((a, b) => {
    return new Date(b.workspace.createdAt).getTime() - new Date(a.workspace.createdAt).getTime();
  });

  // Prepare simplified data for client components including creator information
  const simplifiedWorkspaces = sortedWorkspaces.map((ws) => ({
    id: ws.workspace.id,
    name: ws.workspace.name,
    createdAt: ws.workspace.createdAt,
    creator: ws.workspace.creator?.name || 'Unknown',
  }));

  // Determine if we need to draw attention to the voice ID button
  const needsMoreVoiceSamples = !voiceIdentities.data || voiceIdentities.data?.length < 3;

  return (
    <div className="flex w-full items-center justify-center p-2 md:p-0">
      <div className="container mx-auto flex max-w-screen-2xl items-center justify-between">
        {/* Logo - visible on all screen sizes */}
        <div className="flex items-center gap-2">
          <Link prefetch href="/" className="flex items-center gap-2">
            <CassetteTape className="h-6 w-6 text-blue-500" />
            <span className="text-lg font-semibold">Standup</span>
          </Link>
        </div>

        {/* Middle section - different on mobile vs desktop */}
        <div className="flex-1 px-4">
          {/* Desktop navigation elements - only visible on md screens and above */}
          <div className="hidden items-center gap-4 md:flex">
            <WorkspaceSelector currentWorkspaceId={workspaceId} workspaces={simplifiedWorkspaces} />

            {breadcrumbs && breadcrumbs.length > 0 && (
              <nav className="flex" aria-label="Breadcrumb">
                <ol className="flex items-center space-x-1">
                  {breadcrumbs.map((item, index) => (
                    <li key={item.href} className="flex items-center">
                      {index > 0 && <ChevronRight className="text-muted-foreground mx-1 h-4 w-4" />}
                      <Link
                        href={item.href}
                        prefetch
                        aria-current={item.current ? 'page' : undefined}
                        className={`text-sm ${item.current ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ol>
              </nav>
            )}

            <WorkspaceSettingsDialog
              workspace={workspace}
              members={members.data || []}
              currentUserId={session?.user?.id || ''}
            />
          </div>

          {/* Mobile workspace selector - only visible on small screens */}
          <div className="flex items-center justify-center md:hidden">
            <WorkspaceSelector currentWorkspaceId={workspaceId} workspaces={simplifiedWorkspaces} />
          </div>
        </div>

        {/* Right section - different components for mobile vs desktop */}
        <div className="flex items-center gap-2">
          {/* Desktop controls */}
          <div className="hidden items-center gap-2 md:flex">
            <div className="relative">
              {/* Replace VoiceIdentityDialog with Link to the voice-setup page */}
              <Button
                variant="outline"
                className={needsMoreVoiceSamples ? 'voice-attention' : ''}
                asChild
              >
                <Link href={`/workspace/${workspaceId}/voice-setup`} prefetch>
                  <Mic className="mr-2 h-4 w-4" />
                  {voiceIdentities.data && voiceIdentities.data.length > 0
                    ? `Voice Samples (${voiceIdentities.data.length}/3)`
                    : 'Set Up Voice ID'}
                </Link>
              </Button>
            </div>
            <UserProfileMenu user={session?.user} />
          </div>

          {/* Mobile controls */}
          <div className="flex items-center gap-2 md:hidden">
            {/* Menu dialog */}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Menu</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogTitle className="text-lg font-medium">Navigation Menu</DialogTitle>
                <div className="flex flex-col gap-4 py-2">
                  {breadcrumbs && breadcrumbs.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-muted-foreground text-sm font-medium">Pages</h3>
                      <nav className="flex" aria-label="Breadcrumb">
                        <ol className="flex w-full flex-col items-start space-y-2">
                          {breadcrumbs.map((item) => (
                            <li key={item.href} className="w-full">
                              <Button
                                variant={item.current ? 'default' : 'ghost'}
                                asChild
                                className="w-full justify-start"
                              >
                                <Link
                                  href={item.href}
                                  prefetch
                                  aria-current={item.current ? 'page' : undefined}
                                >
                                  {item.label}
                                </Link>
                              </Button>
                            </li>
                          ))}
                        </ol>
                      </nav>
                    </div>
                  )}

                  <div className="flex flex-col gap-4">
                    <h3 className="text-muted-foreground text-sm font-medium">Workspace</h3>

                    <div className="space-y-2">
                      {/* Remove the direct link and use the dialog component properly */}
                      <WorkspaceSettingsDialog
                        workspace={workspace}
                        members={members.data || []}
                        currentUserId={session?.user?.id || ''}
                        className="w-full"
                        buttonVariant="outline"
                        buttonClassName="w-full justify-start"
                        buttonLabel={
                          <>
                            <Cog className="mr-2 h-4 w-4" />
                            Workspace Settings
                          </>
                        }
                      />

                      {/* Replace VoiceIdentityDialog with Link to voice-setup page */}
                      <Button
                        variant="outline"
                        className={`w-full justify-start ${needsMoreVoiceSamples ? 'voice-attention' : ''}`}
                        asChild
                      >
                        <Link href={`/workspace/${workspaceId}/voice-setup`} prefetch>
                          <Mic className="mr-2 h-4 w-4" />
                          {voiceIdentities.data && voiceIdentities.data.length > 0
                            ? `Voice Samples (${voiceIdentities.data.length}/3)`
                            : 'Set Up Voice ID'}
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <UserProfileMenu user={session?.user} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkspaceNav;
