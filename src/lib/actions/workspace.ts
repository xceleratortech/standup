'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { workspace, workspaceUser, userVoiceIdentity } from '@/lib/db/schema';
import { user } from '@/lib/db/auth-schema';
import { eq, and, not, count } from 'drizzle-orm';
import { generateSlug } from '@/lib/utils';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import { generateUploadUrl } from '@/lib/s3';

// Server action to get the download URL for voice identity
export const getVoiceIdentityUrl = async (fileKey: string) => {
  try {
    ('use server');
    const { generateDownloadUrl } = await import('@/lib/s3');
    const downloadUrl = await generateDownloadUrl(fileKey);
    return { data: { downloadUrl } };
  } catch (error) {
    console.error('Error getting voice identity URL:', error);
    return { error: 'Failed to get voice identity URL' };
  }
};

// Create a new workspace
export async function createWorkspace({ name }: { name: string }) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { error: 'Unauthorized' };
    }

    const userId = session.user.id;
    const slug = generateSlug(name + ' ' + session.user.email);

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

    revalidatePath('/workspace');
    return { data: newWorkspace };
  } catch (error) {
    console.error('Error creating workspace:', error);
    return { error: 'Failed to create workspace' };
  }
}

// Get all workspaces for the current user
export async function getUserWorkspaces() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { error: 'Unauthorized' };
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

    return {
      data: userWorkspaces.map((item) => ({
        workspace: {
          ...item.workspace,
          creator: {
            name: item.creatorName,
          },
        },
        role: item.role,
      })),
    };
  } catch (error) {
    console.error('Error getting user workspaces:', error);
    return { error: 'Failed to get workspaces' };
  }
}

// Get a single workspace by ID
export async function getWorkspace(workspaceId: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { error: 'Unauthorized' };
    }

    const userId = session.user.id;

    // First check if user has access to this workspace
    const userWorkspace = await db.query.workspaceUser.findFirst({
      where: and(eq(workspaceUser.workspaceId, workspaceId), eq(workspaceUser.userId, userId)),
    });

    if (!userWorkspace) {
      return { error: "Workspace not found or you don't have access" };
    }

    const workspaceData = await db.query.workspace.findFirst({
      where: eq(workspace.id, workspaceId),
    });

    return { data: { ...workspaceData, role: userWorkspace.role } };
  } catch (error) {
    console.error('Error getting workspace:', error);
    return { error: 'Failed to get workspace' };
  }
}

// Update workspace
export async function updateWorkspace({
  workspaceId,
  name,
}: {
  workspaceId: string;
  name: string;
}) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { error: 'Unauthorized' };
    }

    const userId = session.user.id;

    // Check if user is admin
    const userWorkspace = await db.query.workspaceUser.findFirst({
      where: and(eq(workspaceUser.workspaceId, workspaceId), eq(workspaceUser.userId, userId)),
    });

    if (!userWorkspace || userWorkspace.role !== 'admin') {
      return { error: 'Unauthorized to update workspace' };
    }

    const [updatedWorkspace] = await db
      .update(workspace)
      .set({
        name,
        updatedAt: new Date(),
      })
      .where(eq(workspace.id, workspaceId))
      .returning();

    revalidatePath(`/workspace/${workspaceId}`);
    return { data: updatedWorkspace };
  } catch (error) {
    console.error('Error updating workspace:', error);
    return { error: 'Failed to update workspace' };
  }
}

// Delete workspace
export async function deleteWorkspace(workspaceId: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { error: 'Unauthorized' };
    }

    const userId = session.user.id;

    // Check if user is admin
    const userWorkspace = await db.query.workspaceUser.findFirst({
      where: and(eq(workspaceUser.workspaceId, workspaceId), eq(workspaceUser.userId, userId)),
    });

    if (!userWorkspace || userWorkspace.role !== 'admin') {
      return { error: 'Unauthorized to delete workspace' };
    }

    // Delete workspace (cascade will remove workspace users)
    await db.delete(workspace).where(eq(workspace.id, workspaceId));

    revalidatePath('/workspace');
    return { data: { success: true } };
  } catch (error) {
    console.error('Error deleting workspace:', error);
    return { error: 'Failed to delete workspace' };
  }
}

// Create or update a user's voice identity sample
export async function saveUserVoiceIdentity({
  workspaceId,
  fileKey,
  sampleUrl,
  duration,
  durationSeconds,
  sampleName,
}: {
  workspaceId: string;
  fileKey: string;
  sampleUrl?: string;
  duration?: string;
  durationSeconds?: string;
  sampleName?: string;
}) {
  try {
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

    // Count existing voice samples for this user in the workspace
    const voiceSamplesCount = await db
      .select({ count: count() })
      .from(userVoiceIdentity)
      .where(
        and(eq(userVoiceIdentity.workspaceId, workspaceId), eq(userVoiceIdentity.userId, userId))
      )
      .then((result) => result[0]?.count || 0);

    // Check if user already has 3 voice samples
    if (voiceSamplesCount >= 3) {
      return { error: "You've reached the maximum limit of 3 voice samples" };
    }

    // Create a new sample
    const [newSample] = await db
      .insert(userVoiceIdentity)
      .values({
        workspaceId,
        userId,
        fileKey,
        sampleUrl,
        duration,
        durationSeconds,
        sampleName: sampleName || `Voice Sample ${voiceSamplesCount + 1}`,
      })
      .returning();

    revalidatePath(`/workspace/${workspaceId}`);
    return { data: newSample };
  } catch (error) {
    console.error('Error saving voice identity:', error);
    return { error: 'Failed to save voice sample' };
  }
}

// Get a user's voice identity samples
export async function getUserVoiceIdentity({
  workspaceId,
  userId,
}: {
  workspaceId: string;
  userId?: string;
}) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { error: 'Unauthorized' };
    }

    const currentUserId = session.user.id;
    const targetUserId = userId || currentUserId;

    // Check if current user has access to this workspace
    const userWorkspace = await db.query.workspaceUser.findFirst({
      where: and(
        eq(workspaceUser.workspaceId, workspaceId),
        eq(workspaceUser.userId, currentUserId)
      ),
    });

    if (!userWorkspace) {
      return { error: "Workspace not found or you don't have access" };
    }

    // Get all voice identity samples
    const voiceIdentities = await db.query.userVoiceIdentity.findMany({
      where: and(
        eq(userVoiceIdentity.workspaceId, workspaceId),
        eq(userVoiceIdentity.userId, targetUserId)
      ),
      orderBy: userVoiceIdentity.createdAt,
    });

    return { data: voiceIdentities };
  } catch (error) {
    console.error('Error getting user voice identity:', error);
    return { error: 'Failed to get voice samples' };
  }
}

// Delete a specific voice identity sample
export async function deleteUserVoiceIdentitySample({
  workspaceId,
  sampleId,
  userId,
}: {
  workspaceId: string;
  sampleId: string;
  userId?: string;
}) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { error: 'Unauthorized' };
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
        return { error: 'Unauthorized to delete other user voice samples' };
      }
    }

    // Delete the specific voice identity sample
    await db
      .delete(userVoiceIdentity)
      .where(
        and(
          eq(userVoiceIdentity.id, sampleId),
          eq(userVoiceIdentity.workspaceId, workspaceId),
          eq(userVoiceIdentity.userId, targetUserId)
        )
      );

    revalidatePath(`/workspace/${workspaceId}`);
    return { data: { success: true } };
  } catch (error) {
    console.error('Error deleting voice identity sample:', error);
    return { error: 'Failed to delete voice sample' };
  }
}

// Delete all voice identity samples for a user
export async function deleteUserVoiceIdentity({
  workspaceId,
  userId,
}: {
  workspaceId: string;
  userId?: string;
}) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { error: 'Unauthorized' };
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
        return { error: 'Unauthorized to delete other user voice samples' };
      }
    }

    // Delete all voice identity samples for the user
    await db
      .delete(userVoiceIdentity)
      .where(
        and(
          eq(userVoiceIdentity.workspaceId, workspaceId),
          eq(userVoiceIdentity.userId, targetUserId)
        )
      );

    revalidatePath(`/workspace/${workspaceId}`);
    return { data: { success: true } };
  } catch (error) {
    console.error('Error deleting user voice identity:', error);
    return { error: 'Failed to delete voice samples' };
  }
}

// Get all voice identity samples in a workspace
export async function getWorkspaceVoiceIdentities(workspaceId: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { error: 'Unauthorized' };
    }

    const userId = session.user.id;

    // Check if user has access to this workspace
    const userWorkspace = await db.query.workspaceUser.findFirst({
      where: and(eq(workspaceUser.workspaceId, workspaceId), eq(workspaceUser.userId, userId)),
    });

    if (!userWorkspace) {
      return { error: "Workspace not found or you don't have access" };
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

    return {
      data: voiceIdentities.map((item) => ({
        ...item.voiceIdentity,
        user: {
          name: item.userName,
          email: item.userEmail,
        },
      })),
    };
  } catch (error) {
    console.error('Error getting workspace voice identities:', error);
    return { error: 'Failed to get workspace voice samples' };
  }
}

// Generate upload URL for voice identity samples
export async function getVoiceIdentityUploadUrl({
  workspaceId,
  contentType,
}: {
  workspaceId: string;
  fileName?: string; // Make this optional to avoid the error
  contentType: string;
}) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { error: 'Unauthorized' };
    }

    const userId = session.user.id;

    // Check if user has access to this workspace
    const userWorkspace = await db.query.workspaceUser.findFirst({
      where: and(eq(workspaceUser.workspaceId, workspaceId), eq(workspaceUser.userId, userId)),
    });

    if (!userWorkspace) {
      return { error: "Workspace not found or you don't have access" };
    }

    // Generate a unique id for this sample to avoid overwriting previous ones
    const sampleId = uuidv4().split('-')[0];

    // Create a unique file key using workspaceId, userId and sampleId
    const fileKey = `voice-identities/${workspaceId}/${userId}/voice-sample-${sampleId}.mp3`;

    // Create a presigned URL for uploading using the centralized S3 module
    const uploadUrl = await generateUploadUrl(fileKey, contentType);

    return {
      data: {
        uploadUrl,
        fileKey,
      },
    };
  } catch (error) {
    console.error('Error getting voice identity upload URL:', error);
    return { error: 'Failed to generate upload URL' };
  }
}
