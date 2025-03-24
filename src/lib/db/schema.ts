import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { user } from './auth-schema';

export const workspace = pgTable('workspace', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  creatorId: text('creator_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const workspaceUser = pgTable('workspace_user', {
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspace.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  role: text('role').default('member').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const workspaceInvite = pgTable('workspace_invite', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspace.id, { onDelete: 'cascade' }),
  invitedByUserId: text('invited_by_user_id')
    .notNull()
    .references(() => user.id),
  email: text('email'),
  token: text('token').notNull().unique(),
  role: text('role').default('member').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  usedAt: timestamp('used_at'),
});

export const WORKSPACE_ROLES = {
  ADMIN: 'admin',
  MEMBER: 'member',
} as const;

export const MEETING_ROLES = {
  ORGANIZER: 'organizer',
  EDITOR: 'editor',
  COMMENTER: 'commenter',
  VIEWER: 'viewer',
} as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[keyof typeof WORKSPACE_ROLES];
export type MeetingRole = (typeof MEETING_ROLES)[keyof typeof MEETING_ROLES];

export const meeting = pgTable('meeting', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspace.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  startTime: timestamp('start_time'),
  endTime: timestamp('end_time'),
  createdById: text('created_by_id')
    .notNull()
    .references(() => user.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// New table for meeting recordings
export const meetingRecording = pgTable('meeting_recording', {
  id: uuid('id').defaultRandom().primaryKey(),
  meetingId: uuid('meeting_id')
    .notNull()
    .references(() => meeting.id, { onDelete: 'cascade' }),
  fileKey: text('file_key').notNull(),
  recordingUrl: text('recording_url'),
  recordingName: text('recording_name'),
  duration: text('duration'), // We'll keep this as text to maintain flexibility in format (MM:SS)
  durationSeconds: text('duration_seconds'), // Add new field for storing duration in seconds
  createdById: text('created_by_id')
    .notNull()
    .references(() => user.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  transcription: text('transcription'),
});

export const meetingParticipant = pgTable('meeting_participant', {
  meetingId: uuid('meeting_id')
    .notNull()
    .references(() => meeting.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  role: text('role').default(MEETING_ROLES.VIEWER).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const meetingOutcome = pgTable('meeting_outcome', {
  id: uuid('id').defaultRandom().primaryKey(),
  meetingId: uuid('meeting_id')
    .notNull()
    .references(() => meeting.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  content: text('content').notNull(),
  meta: text('meta'),
  createdById: text('created_by_id')
    .notNull()
    .references(() => user.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Table for user voice identity samples per workspace
export const userVoiceIdentity = pgTable('user_voice_identity', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspace.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  fileKey: text('file_key').notNull(),
  sampleUrl: text('sample_url'),
  sampleName: text('sample_name'), // Added sampleName field
  duration: text('duration'),
  durationSeconds: text('duration_seconds'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
