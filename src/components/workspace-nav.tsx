import { getWorkspace, getUserWorkspaces } from '@/lib/actions/workspace';
import { getWorkspaceMembers } from '@/lib/actions/workspace-members';
import { WorkspaceSelector } from '@/components/workspace-selector';
import WorkspaceSettingsDialog from './workspace-settings-dialog';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import UserProfileMenu from './user-profile-menu';

interface WorkspaceNavProps {
  workspaceId: string;
}

async function WorkspaceNav({ workspaceId }: WorkspaceNavProps) {
  // Server-side data fetching
  const userWorkspaces = await getUserWorkspaces();
  const workspaceData = await getWorkspace(workspaceId);
  const members = await getWorkspaceMembers(workspaceId);
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Ensure workspace has all required non-optional properties
  const workspace = {
    id: workspaceData.id || '',
    name: workspaceData.name || '',
    createdAt: workspaceData.createdAt || new Date(),
    updatedAt: workspaceData.updatedAt || new Date(),
    slug: workspaceData.slug || '',
    creatorId: workspaceData.creatorId || '',
  };

  // Prepare simplified data for client components
  const simplifiedWorkspaces = userWorkspaces.map((ws) => ({
    id: ws.workspace.id,
    name: ws.workspace.name,
  }));

  return (
    <div className='flex items-center justify-between'>
      <div className='container flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <WorkspaceSelector
            currentWorkspaceId={workspaceId}
            workspaces={simplifiedWorkspaces}
          />
          <WorkspaceSettingsDialog workspace={workspace} members={members} />
        </div>
        <UserProfileMenu user={session?.user} />
      </div>
    </div>
  );
}

export default WorkspaceNav;
