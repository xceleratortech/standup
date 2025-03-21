import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sendEmail } from '@/app/actions/email';
import {
  createVerificationEmail,
  createResetPasswordEmail,
  createChangeEmailVerification,
  createDeleteAccountEmail,
} from './email-templates';
import { db } from './db';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

if (!process.env.GOOGLE_CLIENT_ID) {
  throw new Error('GOOGLE_CLIENT_ID is not set');
}

if (!process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error('GOOGLE_CLIENT_SECRET is not set');
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  plugins: [nextCookies()],
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      const { subject, html } = createVerificationEmail(url);
      await sendEmail({ to: user.email, subject, html });
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 3600,
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: false,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
    sendResetPassword: async ({ user, url }) => {
      const { subject, html } = createResetPasswordEmail(url);
      await sendEmail({ to: user.email, subject, html });
    },
    resetPasswordTokenExpiresIn: 3600,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  user: {
    changeEmail: {
      enabled: true,
      sendChangeEmailVerification: async ({ user, newEmail, url }) => {
        const { subject, html } = createChangeEmailVerification(url);
        await sendEmail({ to: newEmail, subject, html });
      },
    },
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({ user, url }) => {
        const { subject, html } = createDeleteAccountEmail(url);
        await sendEmail({ to: user.email, subject, html });
      },
    },
  },
});
