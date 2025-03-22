import { getWorkspace, getUserWorkspaces } from '@/lib/actions/workspace';
import { getWorkspaceMembers } from '@/lib/actions/workspace-members';
import { WorkspaceSelector } from '@/components/workspace-selector';
import WorkspaceSettingsDialog from './workspace-settings-dialog';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import UserProfileMenu from './user-profile-menu';
import Link from 'next/link';
import { ChevronRight, CassetteTape } from 'lucide-react';

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
          <Link href='/' className='mr-2 flex items-center gap-2'>
            <CassetteTape className='h-6 w-6 text-blue-500' />
            <span className='hidden text-lg font-semibold sm:inline-block'>
              Standup
            </span>
          </Link>

          <WorkspaceSelector
            currentWorkspaceId={workspaceId}
            workspaces={simplifiedWorkspaces}
          />

          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav className='flex' aria-label='Breadcrumb'>
              <ol className='flex items-center space-x-1'>
                {breadcrumbs.map((item, index) => (
                  <li key={item.href} className='flex items-center'>
                    {index > 0 && (
                      <ChevronRight className='text-muted-foreground mx-1 h-4 w-4' />
                    )}
                    <Link
                      href={item.href}
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

          <WorkspaceSettingsDialog workspace={workspace} members={members} />
        </div>
        <UserProfileMenu user={session?.user} />
      </div>
    </div>
  );
}

export default WorkspaceNav;
