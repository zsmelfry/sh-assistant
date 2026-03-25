import { Resend } from 'resend';

/**
 * Send an email via Resend API.
 * If RESEND_API_KEY is not configured, logs a warning and returns a mock ID
 * (allows development without Resend).
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || '个人助手 <noreply@example.com>';

  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not configured — email not sent:', { to, subject });
    return { id: `mock-${Date.now()}` };
  }

  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('[email] Resend API error:', error);
      throw createError({ statusCode: 502, message: '邮件发送失败' });
    }

    return { id: data?.id || `sent-${Date.now()}` };
  } catch (err: any) {
    // Re-throw createError instances
    if (err.statusCode) throw err;

    console.error('[email] Failed to send email:', err);
    throw createError({ statusCode: 502, message: '邮件发送失败' });
  }
}
