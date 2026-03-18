'use client';

import { useState } from 'react';
import { X, Zap, Rocket, Infinity, Mail, Check, Loader2, LogOut, CreditCard, User, ChevronRight } from 'lucide-react';

interface Props {
  onClose: () => void;
  reason?: 'daily_limit' | 'no_credits' | 'no_user';
  dailyCount?: number;
  dailyLimit?: number;
  // Account info (passed when user is logged in)
  loggedIn?: boolean;
  email?: string;
  plan?: string;
  credits?: number;
  onSignOut?: () => void;
}

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$5',
    credits: 500,
    icon: Zap,
    color: 'from-blue-500 to-cyan-500',
    border: 'border-blue-500',
    features: ['500 AI credits / month', 'Stronger text models', 'All 4 compare mode', 'Image generation', 'Monthly billing'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$30',
    credits: 5000,
    icon: Rocket,
    color: 'from-purple-500 to-pink-500',
    border: 'border-purple-500',
    popular: true,
    features: ['5,000 AI credits / month', 'Stronger text models', 'All 4 compare mode', 'Image generation', 'Monthly billing'],
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    price: '$100',
    credits: 50000,
    icon: Infinity,
    color: 'from-orange-500 to-red-500',
    border: 'border-orange-500',
    features: ['50,000 AI credits / month', 'Strongest text models', 'All 4 compare mode', 'Image generation', 'Priority access', 'Monthly billing'],
  },
];

const PLAN_COLORS: Record<string, string> = {
  free: 'text-zinc-400',
  starter: 'text-cyan-400',
  pro: 'text-purple-400',
  unlimited: 'text-orange-400',
};

export default function PaywallModal({ onClose, reason, dailyCount, dailyLimit, loggedIn, email, plan = 'free', credits = 0, onSignOut }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [signOutLoading, setSignOutLoading] = useState(false);

  // Determine initial view
  const defaultView = loggedIn ? 'account' : reason === 'no_user' ? 'login' : 'plans';
  const [view, setView] = useState<'plans' | 'login' | 'account'>(defaultView);

  const isLimit = reason === 'daily_limit';
  const noCredits = reason === 'no_credits';
  const showUpgradePrompt = isLimit || noCredits;
  const freeRemaining = Math.max(0, (dailyLimit ?? 60) - (dailyCount ?? 0));

  async function handleBuy(planId: string) {
    setLoading(planId);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setLoading(null);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setEmailLoading(true);
    setEmailError('');
    try {
      const res = await fetch('/api/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput }),
      });
      if (res.ok) {
        setEmailSent(true);
      } else {
        const d = await res.json();
        setEmailError(d.error ?? 'Failed to send email');
      }
    } catch {
      setEmailError('Network error');
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleSignOut() {
    setSignOutLoading(true);
    await fetch('/api/signout', { method: 'POST' });
    onSignOut?.();
    onClose();
  }

  function handleGoogleSignIn() {
    window.location.href = '/api/auth/google/start';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors z-10">
          <X size={20} />
        </button>

        {/* Header */}
        <div className="p-6 pb-3 text-center">
          {showUpgradePrompt && (
            <div className="inline-flex items-center gap-2 bg-zinc-800 rounded-full px-3 py-1 text-xs text-zinc-400 mb-3">
              {isLimit && <span>You&apos;ve used {dailyCount}/{dailyLimit} free credits today</span>}
              {noCredits && <span>You&apos;ve used all AI credits in your current plan</span>}
            </div>
          )}
          <h2 className="text-2xl font-bold text-white mb-1">
            {view === 'account' ? 'Your Account' : showUpgradePrompt ? 'Upgrade to keep chatting' : 'MultiAI'}
          </h2>
          {view !== 'account' && (
            <p className="text-zinc-400 text-sm">
              {isLimit ? `Free tier resets daily. Upgrade for more usage.`
                : noCredits ? 'Your monthly AI credit allowance is used up. Upgrade to a larger plan.'
                : 'Free uses fast low-cost models with 60 AI credits/day. Paid plans unlock stronger models and monthly credits.'}
            </p>
          )}

          {/* Tab nav */}
          <div className="flex gap-1 justify-center mt-4 bg-zinc-800 rounded-full p-1 w-fit mx-auto">
            {!loggedIn && (
              <button onClick={() => setView('login')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${view === 'login' ? 'bg-white text-zinc-900' : 'text-zinc-400 hover:text-white'}`}>
                Sign In
              </button>
            )}
            <button onClick={() => setView('plans')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${view === 'plans' ? 'bg-white text-zinc-900' : 'text-zinc-400 hover:text-white'}`}>
              Plans
            </button>
            {loggedIn && (
              <button onClick={() => setView('account')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${view === 'account' ? 'bg-white text-zinc-900' : 'text-zinc-400 hover:text-white'}`}>
                Account
              </button>
            )}
          </div>
        </div>

        {/* Plans view */}
        {view === 'plans' && (
          <div className="p-6 pt-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PLANS.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.id} className={`relative flex flex-col rounded-xl border ${p.popular ? p.border : 'border-zinc-700'} bg-zinc-800 p-5 transition-all hover:border-zinc-500`}>
                  {p.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-3 py-0.5 rounded-full whitespace-nowrap">
                      Most Popular
                    </div>
                  )}
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${p.color} flex items-center justify-center mb-3`}>
                    <Icon size={20} className="text-white" />
                  </div>
                  <div className="font-bold text-white text-lg">{p.name}</div>
                  <div className="text-3xl font-bold text-white mt-1 mb-0.5">{p.price}</div>
                  <div className="text-zinc-400 text-xs mb-4">{p.credits.toLocaleString()} AI credits / month</div>
                  <ul className="space-y-1.5 mb-5 flex-1">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs text-zinc-300">
                        <Check size={12} className="text-green-400 shrink-0" />{f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleBuy(p.id)}
                    disabled={loading === p.id}
                    className={`w-full py-2.5 rounded-lg font-semibold text-sm text-white bg-gradient-to-r ${p.color} hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2`}
                  >
                    {loading === p.id ? <Loader2 size={14} className="animate-spin" /> : null}
                    {loading === p.id ? 'Redirecting…' : `Subscribe ${p.name}`}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Login view */}
        {view === 'login' && (
          <div className="p-6 pt-3 max-w-sm mx-auto">
            {emailSent ? (
              <div className="text-center py-8">
                <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check size={28} className="text-green-400" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Check your email</h3>
                <p className="text-zinc-400 text-sm">We sent a magic link to <strong className="text-white">{emailInput}</strong>.</p>
                <p className="text-zinc-500 text-xs mt-2">Click it to sign in. Link expires in 15 minutes.</p>
                <button onClick={() => setEmailSent(false)} className="mt-4 text-xs text-zinc-500 hover:text-zinc-300 underline">
                  Use a different email
                </button>
              </div>
            ) : (
              <>
                <p className="text-zinc-400 text-sm text-center mb-5">
                  Sign in to sync your plan and usage across devices. Use Google or get a magic link by email.
                </p>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full py-2.5 rounded-lg font-semibold text-sm text-white bg-white/8 border border-zinc-700 hover:border-zinc-500 transition-colors flex items-center justify-center gap-2 mb-3"
                >
                  <span className="text-base leading-none">G</span>
                  Continue with Google
                </button>
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-px flex-1 bg-zinc-800" />
                  <span className="text-[11px] uppercase tracking-wide text-zinc-500">or</span>
                  <div className="h-px flex-1 bg-zinc-800" />
                </div>
                <form onSubmit={handleMagicLink} className="space-y-3">
                  <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 focus-within:border-purple-500 transition-colors">
                    <Mail size={16} className="text-zinc-400 shrink-0" />
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="flex-1 bg-transparent text-white text-sm outline-none placeholder-zinc-500"
                    />
                  </div>
                  {emailError && <p className="text-red-400 text-xs">{emailError}</p>}
                  <button
                    type="submit"
                    disabled={emailLoading || !emailInput}
                    className="w-full py-2.5 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
                  >
                    {emailLoading ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                    {emailLoading ? 'Sending…' : 'Send magic link'}
                  </button>
                </form>
                <p className="text-zinc-600 text-xs text-center mt-4">
                  Your anonymous usage will be merged into your account.
                </p>
              </>
            )}
          </div>
        )}

        {/* Account view */}
        {view === 'account' && (
          <div className="p-6 pt-3 max-w-sm mx-auto space-y-4">
            {/* User info */}
            <div className="bg-zinc-800 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0">
                <User size={18} className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-white font-medium text-sm truncate">{email}</p>
                <p className={`text-xs font-semibold capitalize ${PLAN_COLORS[plan] ?? 'text-zinc-400'}`}>
                  {plan} plan
                </p>
              </div>
            </div>

            {/* Credits / usage */}
            <div className="bg-zinc-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 text-sm flex items-center gap-2"><CreditCard size={14} /> Credits remaining</span>
                <span className="text-white font-bold">
                  {plan === 'free'
                    ? credits > 0
                      ? `${credits.toLocaleString()} credits + ${freeRemaining} free today`
                      : `${freeRemaining} free today`
                    : `${credits.toLocaleString()} this month`}
                </span>
              </div>
              {plan === 'free' && (
                <div className="w-full bg-zinc-700 rounded-full h-1.5">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.min(100, ((dailyCount ?? 0) / (dailyLimit ?? 60)) * 100)}%` }}
                  />
                </div>
              )}
            </div>

            {/* Top up */}
            <button
              onClick={() => setView('plans')}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            >
              <CreditCard size={15} />
              Change plan
              <ChevronRight size={15} />
            </button>

            {/* Sign out */}
            <button
              onClick={handleSignOut}
              disabled={signOutLoading}
              className="w-full bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors"
            >
              {signOutLoading ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
              Sign out
            </button>
          </div>
        )}

        <div className="px-6 pb-5 text-center text-zinc-600 text-xs">
          Secure payment via Stripe · Monthly subscription billing
        </div>
      </div>
    </div>
  );
}
