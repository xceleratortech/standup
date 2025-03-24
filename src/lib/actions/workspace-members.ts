'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { workspace, workspaceUser, workspaceInvite } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { generateRandomString } from '@/lib/utils';
import { sendEmail } from '@/app/actions/email'; // Updated import path
import { user } from '@/lib/db/auth-schema';

// Get all members of a workspace
export async function getWorkspaceMembers(workspaceId: string) {
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

  // Get all workspace members with user details including email
  const members = await db
    .select({
      userId: workspaceUser.userId,
      role: workspaceUser.role,
      joinedAt: workspaceUser.createdAt,
      email: user.email,
      name: user.name,
      image: user.image,
    })
    .from(workspaceUser)
    .innerJoin(user, eq(workspaceUser.userId, user.id))
    .where(eq(workspaceUser.workspaceId, workspaceId));

  return members;
}

// Update a member's role
export async function updateMemberRole({
  workspaceId,
  userId,
  newRole,
}: {
  workspaceId: string;
  userId: string;
  newRole: string;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error('Unauthorized');
  }

  const currentUserId = session.user.id;

  // Check if current user is admin
  const userWorkspace = await db.query.workspaceUser.findFirst({
    where: and(eq(workspaceUser.workspaceId, workspaceId), eq(workspaceUser.userId, currentUserId)),
  });

  if (!userWorkspace || userWorkspace.role !== 'admin') {
    throw new Error('Unauthorized to update member roles');
  }

  // Update the member's role
  await db
    .update(workspaceUser)
    .set({
      role: newRole,
      updatedAt: new Date(),
    })
    .where(and(eq(workspaceUser.workspaceId, workspaceId), eq(workspaceUser.userId, userId)));

  revalidatePath(`/workspaces/${workspaceId}/members`);
  return { success: true };
}

// Remove a member from workspace
export async function removeMember({
  workspaceId,
  userId,
}: {
  workspaceId: string;
  userId: string;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error('Unauthorized');
  }

  const currentUserId = session.user.id;

  // Check if current user is admin or the member being removed
  const userWorkspace = await db.query.workspaceUser.findFirst({
    where: and(eq(workspaceUser.workspaceId, workspaceId), eq(workspaceUser.userId, currentUserId)),
  });

  if (!userWorkspace || (userWorkspace.role !== 'admin' && currentUserId !== userId)) {
    throw new Error('Unauthorized to remove members');
  }

  // Remove the member
  await db
    .delete(workspaceUser)
    .where(and(eq(workspaceUser.workspaceId, workspaceId), eq(workspaceUser.userId, userId)));

  revalidatePath(`/workspaces/${workspaceId}/members`);
  return { success: true };
}

// Create an invite to a workspace
export async function createWorkspaceInvite({
  workspaceId,
  email,
  role = 'member',
  expiresInHours = 48,
}: {
  workspaceId: string;
  email?: string;
  role?: string;
  expiresInHours?: number;
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
    throw new Error('Unauthorized to create invites');
  }

  // Generate expiration date
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expiresInHours);

  // Generate a unique token
  const token = generateRandomString(32);

  // Create the invite
  const [invite] = await db
    .insert(workspaceInvite)
    .values({
      workspaceId,
      invitedByUserId: userId,
      email,
      token,
      role,
      expiresAt,
    })
    .returning();

  // If email is provided, send an invitation email
  if (email) {
    const workspaceData = await db.query.workspace.findFirst({
      where: eq(workspace.id, workspaceId),
    });

    // Use the email action from app/actions/email.ts
    await sendEmail({
      to: email,
      subject: `Invitation to join ${workspaceData?.name}`,
      html: `You've been invited to join ${workspaceData?.name}. 
        Click <a href="${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}">here</a> to accept.`,
    });
  }

  return {
    ...invite,
    inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`,
  };
}

// Accept an invite
export async function acceptWorkspaceInvite(token: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error('You must be logged in to accept an invite');
  }

  const userId = session.user.id;
  const email = session.user.email;

  // Find the invite
  const invite = await db.query.workspaceInvite.findFirst({
    where: eq(workspaceInvite.token, token),
  });

  if (!invite) {
    // throw new Error('Invalid or expired invite');
    return { error: 'Invalid or expired invite', success: false };
  }

  // Check if invite has expired
  if (new Date(invite.expiresAt) < new Date()) {
    return { error: 'This invitation has expired', success: false };
  }

  // If the invite was for a specific email, check that it matches
  if (invite.email && invite.email !== email) {
    return { error: 'This invitation was for another email address', success: false };
  }

  // Check if user is already a member
  const existingMember = await db.query.workspaceUser.findFirst({
    where: and(eq(workspaceUser.workspaceId, invite.workspaceId), eq(workspaceUser.userId, userId)),
  });

  if (existingMember) {
    return { error: 'You are already a member of this workspace', success: false };
  }

  // Add user to workspace
  await db.insert(workspaceUser).values({
    workspaceId: invite.workspaceId,
    userId,
    role: invite.role,
  });

  // Mark invite as used
  await db
    .update(workspaceInvite)
    .set({
      usedAt: new Date(),
    })
    .where(eq(workspaceInvite.id, invite.id));

  revalidatePath(`/workspaces/${invite.workspaceId}`);
  return { success: true, workspaceId: invite.workspaceId };
}

// Get all active invites for a workspace
export async function getWorkspaceInvites(workspaceId: string) {
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
    throw new Error('Unauthorized to view invites');
  }

  // Get active invites
  const invites = await db
    .select()
    .from(workspaceInvite)
    .where(and(eq(workspaceInvite.workspaceId, workspaceId), isNull(workspaceInvite.usedAt)));

  return invites.map((invite) => ({
    ...invite,
    inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invite.token}`,
  }));
}

// Delete an invite
export async function deleteWorkspaceInvite(inviteId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

  // Find the invite
  const invite = await db.query.workspaceInvite.findFirst({
    where: eq(workspaceInvite.id, inviteId),
  });

  if (!invite) {
    throw new Error('Invite not found');
  }

  // Check if user is admin in this workspace
  const userWorkspace = await db.query.workspaceUser.findFirst({
    where: and(eq(workspaceUser.workspaceId, invite.workspaceId), eq(workspaceUser.userId, userId)),
  });

  if (!userWorkspace || userWorkspace.role !== 'admin') {
    throw new Error('Unauthorized to delete invites');
  }

  // Delete the invite
  await db.delete(workspaceInvite).where(eq(workspaceInvite.id, inviteId));

  revalidatePath(`/workspaces/${invite.workspaceId}/invites`);
  return { success: true };
}
