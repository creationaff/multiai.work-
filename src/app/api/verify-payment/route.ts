// GET /api/verify-payment?session_id=... — verify Stripe checkout and activate subscription
import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { activateSubscription, Plan } from '@/lib/usage';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id') ?? '';
  if (!sessionId) return Response.json({ error: 'Missing session_id' }, { status: 400 });

  const checkout = await stripe.checkout.sessions.retrieve(sessionId);
  if (checkout.status !== 'complete' || !checkout.subscription) {
    return Response.json({ error: 'Subscription not active' }, { status: 402 });
  }

  const plan = (checkout.metadata?.plan ?? '') as Plan;
  const userId = checkout.metadata?.userId ?? '';
  if (!userId || !plan || plan === 'free') return Response.json({ error: 'Invalid metadata' }, { status: 400 });

  const subscriptionId = typeof checkout.subscription === 'string' ? checkout.subscription : checkout.subscription.id;
  const subscription = (await stripe.subscriptions.retrieve(subscriptionId)) as Stripe.Subscription;
  const subscriptionMeta = subscription as unknown as { current_period_end?: number };
  const currentPeriodEndMs = (subscriptionMeta.current_period_end ?? (Math.floor(Date.now() / 1000) + 31 * 24 * 60 * 60)) * 1000;

  // Get email from Stripe if available
  const email = checkout.customer_details?.email ?? undefined;
  activateSubscription(
    userId,
    plan,
    subscription.id,
    subscription.status,
    currentPeriodEndMs,
    email,
  );

  return Response.json({ ok: true, plan, userId, subscriptionId: subscription.id, status: subscription.status });
}
