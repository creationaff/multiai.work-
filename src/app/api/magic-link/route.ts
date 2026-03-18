// POST /api/magic-link — send magic link email
import { NextRequest } from 'next/server';
import { getOrCreateUserByEmail } from '@/lib/usage';
import { createMagicToken } from '@/lib/auth';
import { sendMagicLink } from '@/lib/email';

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'Invalid email' }, { status: 400 });
  }

  const user = getOrCreateUserByEmail(email);

  const token = createMagicToken(user.userId, email);
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://multiai.work';
  const link = `${base}/api/verify-magic?token=${encodeURIComponent(token)}`;

  try {
    await sendMagicLink(email, link);
  } catch (err) {
    console.error('Email send failed:', err);
    return Response.json({ error: 'Failed to send email' }, { status: 500 });
  }

  return Response.json({ ok: true });
}
