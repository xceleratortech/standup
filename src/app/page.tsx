import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { getUserWorkspaces } from '@/lib/actions/workspace';
import { redirect } from 'next/navigation';

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // If not authenticated, redirect to home/landing page
  if (!session) {
    redirect('/home');
  }

  // Check if user has any workspaces
  const workspaces = await getUserWorkspaces();

  // If user has workspaces, redirect to the first one
  if (workspaces?.data?.length) {
    redirect(`/workspace/${workspaces.data[0].workspace.id}`);
  }

  // If no workspaces, redirect to create workspace page
  redirect('/workspace/create');
}
