import { NextRequest } from 'next/server';
import { verifySessionToken } from '@/lib/auth';
import { deleteHistory, getHistory, MAX_PINNED_CHATS, setPinnedState } from '@/lib/chat-history';

function getSessionUserId(req: NextRequest) {
  const session = req.cookies.get('session')?.value ?? '';
  return verifySessionToken(session);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getSessionUserId(req);
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const item = getHistory(userId, id);
  if (!item) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  return Response.json({ item });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getSessionUserId(req);
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const deleted = deleteHistory(userId, id);
  if (!deleted) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  return Response.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getSessionUserId(req);
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { id } = await params;
  const result = setPinnedState(userId, id, Boolean(body?.pinned));

  if ('error' in result) {
    if (result.error === 'not_found') {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    return Response.json(
      { error: 'Pin limit reached', maxPinned: MAX_PINNED_CHATS },
      { status: 400 }
    );
  }

  return Response.json({ item: result.item });
}
