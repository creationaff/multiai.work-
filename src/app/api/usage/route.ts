// GET /api/usage — return current user's usage info
import { NextRequest } from 'next/server';
import { verifySessionToken } from '@/lib/auth';
import { getUsageSummary, PLANS } from '@/lib/usage';

export async function GET(req: NextRequest) {
  const session = req.cookies.get('session')?.value ?? '';
  const userId = verifySessionToken(session) ?? req.cookies.get('uid')?.value ?? null;

  if (!userId) {
    return Response.json({ loggedIn: false, plan: 'free', dailyCount: 0, dailyLimit: PLANS.free.dailyLimit, monthlyCount: 0, monthlyLimit: 0, credits: 0 });
  }

  return Response.json(await getUsageSummary(userId));
}
