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
