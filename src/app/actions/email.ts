'use server';

import { Resend } from 'resend';
import { z } from 'zod';

const resend = new Resend(process.env.RESEND_API_KEY);

const emailSchema = z.object({
  to: z.string().email(),
  subject: z.string(),
  html: z.string(),
});

type EmailParams = z.infer<typeof emailSchema>;

export async function sendEmail({ to, subject, html }: EmailParams) {
  try {
    const validated = emailSchema.parse({ to, subject, html });

    const { data, error } = await resend.emails.send({
      from: 'Standup App <standup@tri.raj.how>',
      to: validated.to,
      subject: validated.subject,
      html: validated.html,
    });

    if (error) {
      throw new Error(error.message);
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
