// GET /api/verify-magic?token=...&uid=... — verify magic link, merge anon credits, set session
import { NextRequest, NextResponse } from 'next/server';
import { verifyMagicToken, createSessionToken } from '@/lib/auth';
import { getUser, saveUser, mergeAnonymousUsageIntoUser } from '@/lib/usage';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? '';
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://multiai.work';
  const result = verifyMagicToken(token);

  if (!result) {
    return NextResponse.redirect(`${base}/?auth=invalid`);
  }

  // The canonical account for this email
  const emailUser = getUser(result.userId);
  if (!emailUser.email) {
    emailUser.email = result.email;
    saveUser(emailUser);
  }

  // Check if there's an anonymous uid cookie to merge credits from
  const anonUid = req.cookies.get('uid')?.value ?? '';
  mergeAnonymousUsageIntoUser(anonUid, result.userId);

  const session = createSessionToken(result.userId);
  const res = NextResponse.redirect(`${base}/?auth=success`);
  res.cookies.set('session', session, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  return res;
}
