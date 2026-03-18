import crypto from 'crypto';
import { NextResponse } from 'next/server';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
}

export async function GET() {
  if (!GOOGLE_CLIENT_ID) {
    return NextResponse.json({ error: 'Google auth is not configured' }, { status: 500 });
  }

  const baseUrl = getBaseUrl();
  const redirectUri = `${baseUrl}/api/auth/google/callback`;
  const state = crypto.randomBytes(24).toString('hex');

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
    state,
  });

  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  res.cookies.set('google_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/',
  });
  return res;
}
