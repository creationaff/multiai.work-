import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken } from '@/lib/auth';
import { getOrCreateUserByEmail, mergeAnonymousUsageIntoUser } from '@/lib/usage';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
}

export async function GET(req: NextRequest) {
  const baseUrl = getBaseUrl();
  const redirectUri = `${baseUrl}/api/auth/google/callback`;
  const code = req.nextUrl.searchParams.get('code') ?? '';
  const error = req.nextUrl.searchParams.get('error') ?? '';
  const state = req.nextUrl.searchParams.get('state') ?? '';
  const storedState = req.cookies.get('google_oauth_state')?.value ?? '';

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(`${baseUrl}/?auth=google_not_configured`);
  }

  if (error) {
    return NextResponse.redirect(`${baseUrl}/?auth=google_error`);
  }

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(`${baseUrl}/?auth=google_invalid`);
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      return NextResponse.redirect(`${baseUrl}/?auth=google_token_failed`);
    }

    const tokens = await tokenResponse.json() as { access_token?: string };
    if (!tokens.access_token) {
      return NextResponse.redirect(`${baseUrl}/?auth=google_token_failed`);
    }

    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!profileResponse.ok) {
      return NextResponse.redirect(`${baseUrl}/?auth=google_profile_failed`);
    }

    const profile = await profileResponse.json() as { email?: string };
    const email = (profile.email ?? '').trim().toLowerCase();
    if (!email) {
      return NextResponse.redirect(`${baseUrl}/?auth=google_no_email`);
    }

    const user = getOrCreateUserByEmail(email);
    const anonUid = req.cookies.get('uid')?.value ?? '';
    mergeAnonymousUsageIntoUser(anonUid, user.userId);

    const session = createSessionToken(user.userId);
    const res = NextResponse.redirect(`${baseUrl}/?auth=success`);
    res.cookies.set('google_oauth_state', '', { maxAge: 0, path: '/' });
    res.cookies.set('session', session, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
    return res;
  } catch {
    return NextResponse.redirect(`${baseUrl}/?auth=google_callback_failed`);
  }
}
