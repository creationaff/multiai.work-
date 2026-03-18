import { NextRequest } from 'next/server';
import { verifySessionToken } from '@/lib/auth';
import { listHistory, sanitizeProviders, upsertHistory } from '@/lib/chat-history';
import { providersHaveContent } from '@/lib/chat-history-types';

function getSessionUserId(req: NextRequest) {
  const session = req.cookies.get('session')?.value ?? '';
  return verifySessionToken(session);
}

export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return Response.json({ items: listHistory(userId) });
}

export async function POST(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const providers = sanitizeProviders(body?.providers);

  if (!providersHaveContent(providers)) {
    return Response.json({ error: 'Empty chat' }, { status: 400 });
  }

  const item = upsertHistory(userId, typeof body?.id === 'string' ? body.id : undefined, providers);
  return Response.json({ item });
}
