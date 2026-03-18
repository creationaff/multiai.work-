// POST /api/checkout — create Stripe checkout session for monthly subscription
import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { verifySessionToken } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');

const PRICE_MAP: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER ?? '',
  pro: process.env.STRIPE_PRICE_PRO ?? '',
  unlimited: process.env.STRIPE_PRICE_UNLIMITED ?? '',
};

export async function POST(req: NextRequest) {
  const { plan } = await req.json();
  const priceId = PRICE_MAP[plan];
  if (!priceId) return Response.json({ error: 'Invalid plan' }, { status: 400 });

  const session = req.cookies.get('session')?.value ?? '';
  const userId = verifySessionToken(session) ?? req.cookies.get('uid')?.value ?? uuidv4();
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://multiai.work';

  const checkout = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${base}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/?payment=cancelled`,
    metadata: { userId, plan },
    subscription_data: {
      metadata: { userId, plan },
    },
  });

  return Response.json({ url: checkout.url });
}
