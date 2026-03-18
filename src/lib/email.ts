import nodemailer from 'nodemailer';

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 465);
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === 'true'
    : port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
}

export async function sendMagicLink(email: string, link: string) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"MultiAI" <${process.env.SMTP_FROM ?? 'contact@multiai.work'}>`,
    to: email,
    subject: 'Your MultiAI login link',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="margin:0 0 8px">Sign in to MultiAI</h2>
        <p style="color:#666;margin:0 0 24px">Click the button below to sign in. This link expires in 15 minutes.</p>
        <a href="${link}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Sign in to MultiAI</a>
        <p style="color:#999;font-size:12px;margin:24px 0 0">If you didn't request this, you can ignore this email.</p>
      </div>
    `,
  });
}
