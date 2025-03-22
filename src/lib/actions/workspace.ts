'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { workspace, workspaceUser, userVoiceIdentity } from '@/lib/db/schema';
import { user } from '@/lib/db/auth-schema';
import { eq, and } from 'drizzle-orm';
import { generateSlug } from '@/lib/utils';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import { generateUploadUrl } from '@/lib/s3';

// Server action to get the download URL for voice identity
export const getVoiceIdentityUrl = async (fileKey: string) => {
  'use server';
  const { generateDownloadUrl } = await import('@/lib/s3');
  return { downloadUrl: await generateDownloadUrl(fileKey) };
};

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
      creatorName: user.name,
    })
    .from(workspaceUser)
    .innerJoin(workspace, eq(workspaceUser.workspaceId, workspace.id))
    .leftJoin(user, eq(workspace.creatorId, user.id))
    .where(eq(workspaceUser.userId, userId));

  return userWorkspaces.map((item) => ({
    workspace: {
      ...item.workspace,
      creator: {
        name: item.creatorName,
      },
    },
    role: item.role,
  }));
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
    where: and(eq(workspaceUser.workspaceId, workspaceId), eq(workspaceUser.userId, userId)),
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
    where: and(eq(workspaceUser.workspaceId, workspaceId), eq(workspaceUser.userId, userId)),
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
    where: and(eq(workspaceUser.workspaceId, workspaceId), eq(workspaceUser.userId, userId)),
  });

  if (!userWorkspace || userWorkspace.role !== 'admin') {
    throw new Error('Unauthorized to delete workspace');
  }

  // Delete workspace (cascade will remove workspace users)
  await db.delete(workspace).where(eq(workspace.id, workspaceId));

  revalidatePath('/workspaces');
  return { success: true };
}

// Create or update a user's voice identity sample
export async function saveUserVoiceIdentity({
  workspaceId,
  fileKey,
  sampleUrl,
  duration,
  durationSeconds,
}: {
  workspaceId: string;
  fileKey: string;
  sampleUrl?: string;
  duration?: string;
  durationSeconds?: string;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

  // Check if user has access to this workspace
  const userWorkspace = await db.query.workspaceUser.findFirst({
    where: and(eq(workspaceUser.workspaceId, workspaceId), eq(workspaceUser.userId, userId)),
  });

  if (!userWorkspace) {
    throw new Error("Workspace not found or you don't have access");
  }

  // Check if user already has a voice identity sample
  const existingSample = await db.query.userVoiceIdentity.findFirst({
    where: and(
      eq(userVoiceIdentity.workspaceId, workspaceId),
      eq(userVoiceIdentity.userId, userId)
    ),
  });

  if (existingSample) {
    // Update existing sample
    const [updatedSample] = await db
      .update(userVoiceIdentity)
      .set({
        fileKey,
        sampleUrl,
        duration,
        durationSeconds,
        updatedAt: new Date(),
      })
      .where(
        and(eq(userVoiceIdentity.workspaceId, workspaceId), eq(userVoiceIdentity.userId, userId))
      )
      .returning();

    revalidatePath(`/workspaces/${workspaceId}`);
    return updatedSample;
  } else {
    // Create new sample
    const [newSample] = await db
      .insert(userVoiceIdentity)
      .values({
        workspaceId,
        userId,
        fileKey,
        sampleUrl,
        duration,
        durationSeconds,
      })
      .returning();

    revalidatePath(`/workspaces/${workspaceId}`);
    return newSample;
  }
}

// Get a user's voice identity sample
export async function getUserVoiceIdentity({
  workspaceId,
  userId,
}: {
  workspaceId: string;
  userId?: string;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error('Unauthorized');
  }

  const currentUserId = session.user.id;
  const targetUserId = userId || currentUserId;

  // Check if current user has access to this workspace
  const userWorkspace = await db.query.workspaceUser.findFirst({
    where: and(eq(workspaceUser.workspaceId, workspaceId), eq(workspaceUser.userId, currentUserId)),
  });

  if (!userWorkspace) {
    throw new Error("Workspace not found or you don't have access");
  }

  // Get the voice identity sample
  const voiceIdentity = await db.query.userVoiceIdentity.findFirst({
    where: and(
      eq(userVoiceIdentity.workspaceId, workspaceId),
      eq(userVoiceIdentity.userId, targetUserId)
    ),
  });

  return voiceIdentity;
}

// Get all voice identity samples in a workspace
export async function getWorkspaceVoiceIdentities(workspaceId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

  // Check if user has access to this workspace
  const userWorkspace = await db.query.workspaceUser.findFirst({
    where: and(eq(workspaceUser.workspaceId, workspaceId), eq(workspaceUser.userId, userId)),
  });

  if (!userWorkspace) {
    throw new Error("Workspace not found or you don't have access");
  }

  // Get all voice identity samples with user details
  const voiceIdentities = await db
    .select({
      voiceIdentity: userVoiceIdentity,
      userName: user.name,
      userEmail: user.email,
    })
    .from(userVoiceIdentity)
    .innerJoin(user, eq(userVoiceIdentity.userId, user.id))
    .where(eq(userVoiceIdentity.workspaceId, workspaceId));

  return voiceIdentities.map((item) => ({
    ...item.voiceIdentity,
    user: {
      name: item.userName,
      email: item.userEmail,
    },
  }));
}

// Delete a user's voice identity sample
export async function deleteUserVoiceIdentity({
  workspaceId,
  userId,
}: {
  workspaceId: string;
  userId?: string;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error('Unauthorized');
  }

  const currentUserId = session.user.id;
  const targetUserId = userId || currentUserId;

  // If deleting someone else's sample, check if current user is admin
  if (targetUserId !== currentUserId) {
    const userWorkspace = await db.query.workspaceUser.findFirst({
      where: and(
        eq(workspaceUser.workspaceId, workspaceId),
        eq(workspaceUser.userId, currentUserId)
      ),
    });

    if (!userWorkspace || userWorkspace.role !== 'admin') {
      throw new Error('Unauthorized to delete other user voice samples');
    }
  }

  // Delete the voice identity sample
  await db
    .delete(userVoiceIdentity)
    .where(
      and(
        eq(userVoiceIdentity.workspaceId, workspaceId),
        eq(userVoiceIdentity.userId, targetUserId)
      )
    );

  revalidatePath(`/workspaces/${workspaceId}`);
  return { success: true };
}

// Generate upload URL for voice identity samples
export async function getVoiceIdentityUploadUrl({
  workspaceId,
  fileName,
  contentType,
}: {
  workspaceId: string;
  fileName: string;
  contentType: string;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

  // Check if user has access to this workspace
  const userWorkspace = await db.query.workspaceUser.findFirst({
    where: and(eq(workspaceUser.workspaceId, workspaceId), eq(workspaceUser.userId, userId)),
  });

  if (!userWorkspace) {
    throw new Error("Workspace not found or you don't have access");
  }

  // Generate a unique file key
  const fileId = uuidv4();
  const fileKey = `voice-identities/${workspaceId}/${userId}/${fileId}/${fileName}`;

  // Create a presigned URL for uploading using the centralized S3 module
  const uploadUrl = await generateUploadUrl(fileKey, contentType);

  return {
    uploadUrl,
    fileKey,
  };
}
