import { getWorkspace } from '@/lib/actions/workspace';
import { getWorkspaceMembers } from '@/lib/actions/workspace-members';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import MemberActions from './member-actions';

export default async function ManageMemberPage(
  props: {
    params: Promise<{ id: string; userId: string }>;
  }
) {
  const params = await props.params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/');
  }

  try {
    const workspace = await getWorkspace(params.id);

    // Only admins can manage members
    if (workspace.role !== 'admin') {
      redirect(`/workspace/${params.id}`);
    }

    // Get all members to find the one we're managing
    const members = await getWorkspaceMembers(params.id);
    const member = members.find((m) => m.userId === params.userId);

    if (!member) {
      redirect(`/workspace/${params.id}`);
    }

    return (
      <div className='container mx-auto p-6'>
        <div className='mb-8 flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold'>Manage Team Member</h1>
            <p className='text-muted-foreground'>{workspace.name}</p>
          </div>
          <Button asChild variant='outline'>
            <Link href={`/workspace/${params.id}`}>Back to Workspace</Link>
          </Button>
        </div>

        <div className='mx-auto max-w-2xl rounded-lg border p-6'>
          <div className='mb-6'>
            <h2 className='text-xl font-semibold'>
              {member.name || 'Unnamed User'}
            </h2>
            <p className='text-muted-foreground'>{member.email}</p>
            <p className='text-muted-foreground mt-1 text-sm'>
              Current role: <span className='capitalize'>{member.role}</span>
            </p>
          </div>

          <MemberActions
            workspaceId={params.id}
            userId={params.userId}
            currentRole={member.role}
          />
        </div>
      </div>
    );
  } catch (error) {
    redirect(`/workspace/${params.id}`);
  }
}
