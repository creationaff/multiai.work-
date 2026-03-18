// Server-side usage tracking via JSON file on disk.
// Free users get a small daily pool of AI credits.
// Paid users get monthly AI credits, and each request burns credits based on cost.

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import Stripe from 'stripe';

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'data');
const USAGE_FILE = path.join(DATA_DIR, 'usage.json');

export const PLANS = {
  free:      { label: 'Free',      dailyLimit: 60, monthlyLimit: 0,     price: 0   },
  starter:   { label: 'Starter',   dailyLimit: 0,  monthlyLimit: 500,   price: 5   },
  pro:       { label: 'Pro',       dailyLimit: 0,  monthlyLimit: 5000,  price: 30  },
  unlimited: { label: 'Unlimited', dailyLimit: 0,  monthlyLimit: 50000, price: 100 },
} as const;

export type Plan = keyof typeof PLANS;
export type Provider = 'openai' | 'anthropic' | 'google' | 'xai';

const PREMIUM_CHAT_COST: Record<Provider, number> = {
  openai: 8,
  anthropic: 6,
  google: 5,
  xai: 6,
};

const FAST_CHAT_COST: Record<Provider, number> = {
  openai: 1,
  anthropic: 1,
  google: 1,
  xai: 1,
};

const FAST_FILE_UPLOAD_COST = 1;
const PREMIUM_FILE_UPLOAD_COST = 2;
export const IMAGE_REQUEST_COST = 6;

export function getChatRequestCost(
  provider: Provider,
  { premium, hasFiles }: { premium: boolean; hasFiles: boolean }
) {
  const base = premium ? PREMIUM_CHAT_COST[provider] : FAST_CHAT_COST[provider];
  const fileCost = hasFiles ? (premium ? PREMIUM_FILE_UPLOAD_COST : FAST_FILE_UPLOAD_COST) : 0;
  return base + fileCost;
}

// Sliding-window timestamps stored per user
export interface UserRecord {
  userId: string;
  email?: string;
  plan: Plan;
  credits: number; // legacy one-time credits, still honored if they exist
  dailyCount: number;
  dailyDate: string;
  monthlyCount: number;
  monthlyPeriod: string; // YYYY-MM UTC month bucket
  subscriptionId?: string;
  subscriptionStatus?: string;
  subscriptionCurrentPeriodEnd?: number; // epoch ms
  recentTs: number[];
  createdAt: string;
}

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readAll(): Record<string, UserRecord> {
  ensureDir();
  if (!fs.existsSync(USAGE_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8')); } catch { return {}; }
}

function writeAll(data: Record<string, UserRecord>) {
  ensureDir();
  fs.writeFileSync(USAGE_FILE, JSON.stringify(data, null, 2));
}

export function getUser(userId: string): UserRecord {
  const all = readAll();
  if (!all[userId]) {
    all[userId] = {
      userId,
      plan: 'free',
      credits: 0,
      dailyCount: 0,
      dailyDate: todayUTC(),
      monthlyCount: 0,
      monthlyPeriod: monthUTC(),
      recentTs: [],
      createdAt: new Date().toISOString(),
    };
    writeAll(all);
  }
  // Backfill new fields for old records
  if (!all[userId].recentTs) all[userId].recentTs = [];
  if (typeof all[userId].monthlyCount !== 'number') all[userId].monthlyCount = 0;
  if (!all[userId].monthlyPeriod) all[userId].monthlyPeriod = monthUTC();
  return all[userId];
}

export function saveUser(record: UserRecord) {
  const all = readAll();
  all[record.userId] = record;
  writeAll(all);
}

export function getUserByEmail(email: string): UserRecord | null {
  const all = readAll();
  return Object.values(all).find((u) => u.email === email) ?? null;
}

export function getOrCreateUserByEmail(email: string): UserRecord {
  const existing = getUserByEmail(email);
  if (existing) return existing;

  const user = getUser(crypto.randomUUID());
  user.email = email;
  saveUser(user);
  return user;
}

export function mergeAnonymousUsageIntoUser(anonUserId: string, targetUserId: string) {
  if (!anonUserId || anonUserId === targetUserId) return;

  const anonUser = getUser(anonUserId);
  const targetUser = getUser(targetUserId);

  if (anonUser.plan === 'free' && targetUser.plan === 'free') {
    const today = todayUTC();
    const anonToday = anonUser.dailyDate === today ? anonUser.dailyCount : 0;
    if (targetUser.dailyDate !== today) {
      targetUser.dailyCount = anonToday;
      targetUser.dailyDate = today;
    } else {
      targetUser.dailyCount = Math.min(targetUser.dailyCount + anonToday, 999);
    }
  }

  if (anonUser.credits > 0) {
    targetUser.credits += anonUser.credits;
    anonUser.credits = 0;
  }

  const planRank = { free: 0, starter: 1, pro: 2, unlimited: 3 };
  if (planRank[anonUser.plan] > planRank[targetUser.plan]) {
    targetUser.plan = anonUser.plan;
  }

  saveUser(anonUser);
  saveUser(targetUser);
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthUTC(): string {
  return new Date().toISOString().slice(0, 7);
}

function isValidSubscriptionStatus(status?: string) {
  return status === 'active' || status === 'trialing';
}

async function syncSubscription(user: UserRecord) {
  const today = todayUTC();
  const month = monthUTC();

  if (user.dailyDate !== today) {
    user.dailyCount = 0;
    user.dailyDate = today;
  }

  if (user.monthlyPeriod !== month) {
    user.monthlyCount = 0;
    user.monthlyPeriod = month;
  }

  if (!user.subscriptionId || !stripe) return user;

  try {
    const subscription = await stripe.subscriptions.retrieve(user.subscriptionId);
    const subscriptionMeta = subscription as unknown as { current_period_end?: number };
    user.subscriptionStatus = subscription.status;
    user.subscriptionCurrentPeriodEnd = (subscriptionMeta.current_period_end ?? (Math.floor(Date.now() / 1000) + 31 * 24 * 60 * 60)) * 1000;

    const metadataPlan = subscription.metadata?.plan as Plan | undefined;
    if (isValidSubscriptionStatus(subscription.status)) {
      if (metadataPlan && metadataPlan !== 'free') {
        user.plan = metadataPlan;
      }
    } else if (subscription.status === 'canceled' || subscription.status === 'unpaid' || subscription.status === 'incomplete_expired') {
      user.plan = 'free';
      user.subscriptionId = undefined;
      user.subscriptionStatus = undefined;
      user.subscriptionCurrentPeriodEnd = undefined;
      user.monthlyCount = 0;
      user.monthlyPeriod = month;
    }
  } catch {
    // Keep existing local state if Stripe lookup fails
  }
}

export type RateLimitReason = 'daily_limit' | 'no_credits';

export interface UsageCheck {
  allowed: boolean;
  reason?: RateLimitReason;
  dailyCount: number;
  dailyLimit: number;
  credits: number;
  plan: Plan;
}

export async function checkAndConsume(userId: string, cost = 1): Promise<UsageCheck> {
  const user = getUser(userId);
  await syncSubscription(user);
  const now = Date.now();
  const plan = PLANS[user.plan];
  const units = Math.max(1, Math.ceil(cost));

  // --- Daily limit (free only, measured in AI credits) ---
  if (user.plan === 'free') {
    if (user.dailyCount + units <= plan.dailyLimit) {
      user.dailyCount += units;
      user.recentTs.push(now);
      saveUser(user);
      return { allowed: true, dailyCount: user.dailyCount, dailyLimit: plan.dailyLimit, credits: user.credits, plan: user.plan };
    }

    if (user.credits >= units) {
      user.credits -= units;
      user.recentTs.push(now);
      saveUser(user);
      return { allowed: true, dailyCount: user.dailyCount, dailyLimit: plan.dailyLimit, credits: user.credits, plan: user.plan };
    }

    saveUser(user);
    return {
      allowed: false,
      reason: 'daily_limit',
      dailyCount: user.dailyCount,
      dailyLimit: plan.dailyLimit,
      credits: user.credits,
      plan: user.plan,
    };
  }

  // --- Paid: active subscription monthly AI credits ---
  if (isValidSubscriptionStatus(user.subscriptionStatus) && plan.monthlyLimit > 0) {
    if (user.monthlyCount + units > plan.monthlyLimit) {
      saveUser(user);
      return {
        allowed: false,
        reason: 'no_credits',
        dailyCount: 0,
        dailyLimit: 0,
        credits: 0,
        plan: user.plan,
      };
    }

    user.monthlyCount += units;
    user.recentTs.push(now);
    saveUser(user);
    return {
      allowed: true,
      dailyCount: 0,
      dailyLimit: 0,
      credits: Math.max(0, plan.monthlyLimit - user.monthlyCount),
      plan: user.plan,
    };
  }

  // --- Legacy fallback: honor existing one-time credit balances ---
  if (user.credits >= units) {
    user.credits -= units;
    user.recentTs.push(now);
    saveUser(user);
    return { allowed: true, dailyCount: 0, dailyLimit: 0, credits: user.credits, plan: user.plan };
  }

  saveUser(user);
  return { allowed: false, reason: 'no_credits', dailyCount: 0, dailyLimit: 0, credits: 0, plan: user.plan };
}

export function addCredits(userId: string, plan: Plan, credits: number, email?: string) {
  const user = getUser(userId);
  user.plan = plan;
  user.credits += credits;
  if (email) user.email = email;
  saveUser(user);
}

export function activateSubscription(userId: string, plan: Plan, subscriptionId: string, subscriptionStatus: string, currentPeriodEndMs: number, email?: string) {
  const user = getUser(userId);
  user.plan = plan;
  user.subscriptionId = subscriptionId;
  user.subscriptionStatus = subscriptionStatus;
  user.subscriptionCurrentPeriodEnd = currentPeriodEndMs;
  user.monthlyPeriod = monthUTC();
  if (!isValidSubscriptionStatus(subscriptionStatus)) {
    user.monthlyCount = 0;
  }
  if (email) user.email = email;
  saveUser(user);
}

export async function getUsageSummary(userId: string) {
  const user = getUser(userId);
  await syncSubscription(user);
  saveUser(user);

  const plan = PLANS[user.plan];
  const dailyCount = user.dailyDate === todayUTC() ? user.dailyCount : 0;
  const monthlyCount = user.monthlyPeriod === monthUTC() ? user.monthlyCount : 0;
  const remainingCredits =
    user.plan === 'free'
      ? user.credits
      : isValidSubscriptionStatus(user.subscriptionStatus)
        ? Math.max(0, plan.monthlyLimit - monthlyCount)
        : user.credits;

  return {
    loggedIn: Boolean(user.email),
    email: user.email,
    plan: user.plan,
    dailyCount,
    dailyLimit: PLANS.free.dailyLimit,
    monthlyCount,
    monthlyLimit: plan.monthlyLimit,
    credits: remainingCredits,
    subscriptionStatus: user.subscriptionStatus,
  };
}
