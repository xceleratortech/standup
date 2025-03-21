import { Authenticate } from '@/components/auth';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { getUserWorkspaces } from '@/lib/actions/workspace';
import { redirect } from 'next/navigation';

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session)
    return (
      <div className='flex h-screen items-center justify-center'>
        <main className='w-full max-w-md space-y-8 p-6'>
          <Authenticate />
        </main>
      </div>
    );

  // Check if user has any workspaces
  const workspaces = await getUserWorkspaces();

  // If user has workspaces, redirect to the first one
  if (workspaces.length > 0) {
    redirect(`/workspace/${workspaces[0].workspace.id}`);
  }

  // If no workspaces, redirect to create workspace page
  redirect('/workspace/create');
}
