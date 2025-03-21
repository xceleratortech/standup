'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { workspace, workspaceUser } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateSlug } from '@/lib/utils';
import { revalidatePath } from 'next/cache';

// Create a new workspace
export async function createWorkspace({ name }: { name: string }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;
  const slug = generateSlug(name);

  const [newWorkspace] = await db
    .insert(workspace)
    .values({
      name,
      slug,
      creatorId: userId,
    })
    .returning();

  // Add creator as an admin
  await db.insert(workspaceUser).values({
    workspaceId: newWorkspace.id,
    userId,
    role: 'admin',
  });

  revalidatePath('/workspaces');
  return newWorkspace;
}

// Get all workspaces for the current user
export async function getUserWorkspaces() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

  const userWorkspaces = await db
    .select({
      workspace: workspace,
      role: workspaceUser.role,
    })
    .from(workspaceUser)
    .innerJoin(workspace, eq(workspaceUser.workspaceId, workspace.id))
    .where(eq(workspaceUser.userId, userId));

  return userWorkspaces;
}

// Get a single workspace by ID
export async function getWorkspace(workspaceId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

  // First check if user has access to this workspace
  const userWorkspace = await db.query.workspaceUser.findFirst({
    where: and(
      eq(workspaceUser.workspaceId, workspaceId),
      eq(workspaceUser.userId, userId)
    ),
  });

  if (!userWorkspace) {
    throw new Error("Workspace not found or you don't have access");
  }

  const workspaceData = await db.query.workspace.findFirst({
    where: eq(workspace.id, workspaceId),
  });

  return { ...workspaceData, role: userWorkspace.role };
}

// Update workspace
export async function updateWorkspace({
  workspaceId,
  name,
}: {
  workspaceId: string;
  name: string;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

  // Check if user is admin
  const userWorkspace = await db.query.workspaceUser.findFirst({
    where: and(
      eq(workspaceUser.workspaceId, workspaceId),
      eq(workspaceUser.userId, userId)
    ),
  });

  if (!userWorkspace || userWorkspace.role !== 'admin') {
    throw new Error('Unauthorized to update workspace');
  }

  const [updatedWorkspace] = await db
    .update(workspace)
    .set({
      name,
      updatedAt: new Date(),
    })
    .where(eq(workspace.id, workspaceId))
    .returning();

  revalidatePath(`/workspaces/${workspaceId}`);
  return updatedWorkspace;
}

// Delete workspace
export async function deleteWorkspace(workspaceId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

  // Check if user is admin
  const userWorkspace = await db.query.workspaceUser.findFirst({
    where: and(
      eq(workspaceUser.workspaceId, workspaceId),
      eq(workspaceUser.userId, userId)
    ),
  });

  if (!userWorkspace || userWorkspace.role !== 'admin') {
    throw new Error('Unauthorized to delete workspace');
  }

  // Delete workspace (cascade will remove workspace users)
  await db.delete(workspace).where(eq(workspace.id, workspaceId));

  revalidatePath('/workspaces');
  return { success: true };
}
