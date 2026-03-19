'use client';

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { ChatWindow, ChatWindowHandle } from '@/components/ChatWindow';
import HistoryPanel from '@/components/HistoryPanel';
import PaywallModal from '@/components/PaywallModal';
import {
  ProviderChatSnapshot,
  ProviderId,
  WorkspaceHistoryItem,
  WorkspaceHistoryProviders,
  WorkspaceHistorySummary,
  createEmptyProviders,
  providersHaveContent,
} from '@/lib/chat-history-types';
import { Mail, PanelLeft, Send, User } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import packageJson from '../../package.json';

type PanelGroupHandle = {
  getLayout: () => Record<string, number>;
  setLayout: (layout: Record<string, number>) => Record<string, number>;
};

interface UsageInfo {
  loggedIn: boolean;
  email?: string;
  plan: string;
  dailyCount: number;
  dailyLimit: number;
  credits: number;
  monthlyCount?: number;
  monthlyLimit?: number;
  subscriptionStatus?: string;
}

interface PaywallState {
  open: boolean;
  reason?: 'daily_limit' | 'no_credits' | 'no_user';
  dailyCount?: number;
  dailyLimit?: number;
}

function toSummary(item: WorkspaceHistoryItem): WorkspaceHistorySummary {
  return {
    id: item.id,
    title: item.title,
    snippet: item.snippet,
    pinned: item.pinned,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function sortHistoryItems(items: WorkspaceHistorySummary[]) {
  return [...items].sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return a.pinned ? -1 : 1;
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export default function Home() {
  const [broadcastInput, setBroadcastInput] = useState('');
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [paywall, setPaywall] = useState<PaywallState>({ open: false });
  const [horizontalLayout, setHorizontalLayout] = useState<[number, number]>([50, 50]);
  const [verticalLayout, setVerticalLayout] = useState<[number, number]>([50, 50]);
  const [isCenterDragging, setIsCenterDragging] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<WorkspaceHistorySummary[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDeletingId, setHistoryDeletingId] = useState<string | null>(null);
  const [historyPinningId, setHistoryPinningId] = useState<string | null>(null);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [providerSnapshots, setProviderSnapshots] = useState<WorkspaceHistoryProviders>(() => createEmptyProviders());
  const openaiRef = useRef<ChatWindowHandle>(null);
  const anthropicRef = useRef<ChatWindowHandle>(null);
  const googleRef = useRef<ChatWindowHandle>(null);
  const xaiRef = useRef<ChatWindowHandle>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const horizontalGroupRef = useRef<PanelGroupHandle | null>(null);
  const leftVerticalGroupRef = useRef<PanelGroupHandle | null>(null);
  const rightVerticalGroupRef = useRef<PanelGroupHandle | null>(null);
  const syncingVerticalRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressAutosaveRef = useRef(false);
  const lastSavedSignatureRef = useRef('');

  const loggedIn = Boolean(usage?.loggedIn);

  const applySnapshotsToPanels = useCallback((providers: WorkspaceHistoryProviders) => {
    openaiRef.current?.loadSnapshot(providers.openai);
    anthropicRef.current?.loadSnapshot(providers.anthropic);
    googleRef.current?.loadSnapshot(providers.google);
    xaiRef.current?.loadSnapshot(providers.xai);
    setProviderSnapshots(providers);
  }, []);

  const clearWorkspace = useCallback((options?: { closeHistory?: boolean }) => {
    suppressAutosaveRef.current = true;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    lastSavedSignatureRef.current = '';
    setActiveHistoryId(null);
    const empty = createEmptyProviders();
    setProviderSnapshots(empty);
    openaiRef.current?.clearConversation();
    anthropicRef.current?.clearConversation();
    googleRef.current?.clearConversation();
    xaiRef.current?.clearConversation();
    if (options?.closeHistory) setIsHistoryOpen(false);
    window.setTimeout(() => {
      suppressAutosaveRef.current = false;
    }, 0);
  }, []);

  // Ensure anonymous user ID cookie exists
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!document.cookie.includes('uid=')) {
      const uid = uuidv4();
      document.cookie = `uid=${uid}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    }
  }, []);

  const refreshUsage = useCallback(async () => {
    try {
      const res = await fetch('/api/usage');
      const data = await res.json();
      setUsage(data);
    } catch { /* ignore */ }
  }, []);

  // Check for payment/auth success in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const sessionId = params.get('session_id');
    const auth = params.get('auth');

    if (payment === 'success' && sessionId) {
      fetch(`/api/verify-payment?session_id=${sessionId}`)
        .then(() => refreshUsage())
        .catch(console.error);
    }
    if (auth === 'success') {
      queueMicrotask(() => {
        void refreshUsage();
      });
    }
    if (auth || payment) {
      window.history.replaceState({}, '', '/');
    }
  }, [refreshUsage]);

  useEffect(() => {
    queueMicrotask(() => {
      void refreshUsage();
    });
  }, [refreshUsage]);

  const fetchHistory = useCallback(async () => {
    if (!loggedIn) {
      setHistoryItems([]);
      return;
    }

    setHistoryLoading(true);
    try {
      const res = await fetch('/api/history', { cache: 'no-store' });
      if (!res.ok) {
        setHistoryItems([]);
        return;
      }
      const data = await res.json();
      setHistoryItems(sortHistoryItems(Array.isArray(data.items) ? data.items : []));
    } catch {
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [loggedIn]);

  useEffect(() => {
    if (!loggedIn) {
      setHistoryItems([]);
      setActiveHistoryId(null);
      lastSavedSignatureRef.current = '';
      return;
    }
    void fetchHistory();
  }, [fetchHistory, loggedIn]);

  const handlePaywallTrigger = useCallback((reason: 'daily_limit' | 'no_credits' | 'no_user', dailyCount?: number, dailyLimit?: number) => {
    setPaywall({ open: true, reason, dailyCount, dailyLimit });
  }, []);

  const handleBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastInput.trim()) return;
    const text = broadcastInput.trim();
    openaiRef.current?.sendBroadcast(text);
    anthropicRef.current?.sendBroadcast(text);
    googleRef.current?.sendBroadcast(text);
    xaiRef.current?.sendBroadcast(text);
    setBroadcastInput('');
  };

  const handleUserIconClick = () => {
    if (usage?.loggedIn) {
      // Show account dashboard
      setPaywall({ open: true, reason: undefined });
    } else {
      // Show login
      setPaywall({ open: true, reason: 'no_user' });
    }
  };

  const handleSignOut = useCallback(async () => {
    setIsHistoryOpen(false);
    await refreshUsage();
  }, [refreshUsage]);

  const handleProviderConversationChange = useCallback((provider: ProviderId, snapshot: ProviderChatSnapshot) => {
    setProviderSnapshots((prev) => ({
      ...prev,
      [provider]: snapshot,
    }));
  }, []);

  const handleSelectHistory = useCallback(async (id: string) => {
    suppressAutosaveRef.current = true;
    try {
      const res = await fetch(`/api/history/${id}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const item = data.item as WorkspaceHistoryItem;
      if (!item?.providers) return;
      setActiveHistoryId(item.id);
      applySnapshotsToPanels(item.providers);
      lastSavedSignatureRef.current = JSON.stringify({ id: item.id, providers: item.providers });
      setIsHistoryOpen(false);
    } catch {
      // ignore
    } finally {
      window.setTimeout(() => {
        suppressAutosaveRef.current = false;
      }, 0);
    }
  }, [applySnapshotsToPanels]);

  const handleDeleteHistory = useCallback(async (id: string) => {
    setHistoryDeletingId(id);
    try {
      const res = await fetch(`/api/history/${id}`, { method: 'DELETE' });
      if (!res.ok) return;
      setHistoryItems((prev) => prev.filter((item) => item.id !== id));
      if (activeHistoryId === id) {
        clearWorkspace();
      }
    } catch {
      // ignore
    } finally {
      setHistoryDeletingId(null);
    }
  }, [activeHistoryId, clearWorkspace]);

  const handleTogglePin = useCallback(async (id: string, pinned: boolean) => {
    setHistoryPinningId(id);
    try {
      const res = await fetch(`/api/history/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned }),
      });

      if (!res.ok) return;

      const data = await res.json();
      const summary = toSummary(data.item as WorkspaceHistoryItem);
      setHistoryItems((prev) => sortHistoryItems(prev.map((item) => (
        item.id === id ? summary : item
      ))));
    } catch {
      // ignore
    } finally {
      setHistoryPinningId(null);
    }
  }, []);

  useEffect(() => {
    if (!loggedIn || suppressAutosaveRef.current || !providersHaveContent(providerSnapshots)) {
      return;
    }

    const pendingSignature = JSON.stringify({ id: activeHistoryId, providers: providerSnapshots });
    if (pendingSignature === lastSavedSignatureRef.current) {
      return;
    }

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: activeHistoryId,
            providers: providerSnapshots,
          }),
        });

        if (!res.ok) return;

        const data = await res.json();
        const item = data.item as WorkspaceHistoryItem;
        const summary = toSummary(item);

        setActiveHistoryId(item.id);
        setHistoryItems((prev) => {
          const next = [summary, ...prev.filter((entry) => entry.id !== item.id)];
          return sortHistoryItems(next);
        });
        lastSavedSignatureRef.current = JSON.stringify({ id: item.id, providers: providerSnapshots });
      } catch {
        // ignore autosave failures
      }
    }, 800);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [activeHistoryId, loggedIn, providerSnapshots]);

  const applyVerticalLayout = useCallback((nextLayout: [number, number]) => {
    setVerticalLayout(nextLayout);
    leftVerticalGroupRef.current?.setLayout({ top: nextLayout[0], bottom: nextLayout[1] });
    rightVerticalGroupRef.current?.setLayout({ top: nextLayout[0], bottom: nextLayout[1] });
  }, []);

  const handleVerticalLayoutChange = useCallback((layout: Record<string, number>) => {
    const nextLayout: [number, number] = [layout.top ?? 50, layout.bottom ?? 50];
    if (syncingVerticalRef.current) return;

    syncingVerticalRef.current = true;
    applyVerticalLayout(nextLayout);
    queueMicrotask(() => {
      syncingVerticalRef.current = false;
    });
  }, [applyVerticalLayout]);

  const handleHorizontalLayoutChange = useCallback((layout: Record<string, number>) => {
    setHorizontalLayout([layout.left ?? 50, layout.right ?? 50]);
  }, []);

  const clampSplit = useCallback((value: number) => Math.min(80, Math.max(20, value)), []);

  const handleCenterPointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();

    const move = (moveEvent: PointerEvent) => {
      const rect = gridRef.current?.getBoundingClientRect();
      if (!rect) return;

      const nextHorizontal = clampSplit(((moveEvent.clientX - rect.left) / rect.width) * 100);
      const nextVertical = clampSplit(((moveEvent.clientY - rect.top) / rect.height) * 100);

      const horizontalNext: [number, number] = [nextHorizontal, 100 - nextHorizontal];
      const verticalNext: [number, number] = [nextVertical, 100 - nextVertical];

      horizontalGroupRef.current?.setLayout({ left: horizontalNext[0], right: horizontalNext[1] });
      setHorizontalLayout(horizontalNext);
      applyVerticalLayout(verticalNext);
    };

    const stop = () => {
      setIsCenterDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };

    setIsCenterDragging(true);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  }, [applyVerticalLayout, clampSplit]);

  const centerHandleStyle = useMemo(() => ({
    left: `calc(${horizontalLayout[0]}% - 11px)`,
    top: `calc(${verticalLayout[0]}% - 11px)`,
  }), [horizontalLayout, verticalLayout]);

  // Free tier: show remaining count; paid: show monthly remaining
  const freeLeft = usage ? Math.max(0, usage.dailyLimit - usage.dailyCount) : 0;
  const planBadge = usage
    ? usage.plan === 'free'
      ? usage.credits > 0
        ? { label: `${usage.credits.toLocaleString()} credits + ${freeLeft} free`, warn: freeLeft <= 3 }
        : { label: `${freeLeft} free credits left`, warn: usage.dailyCount >= usage.dailyLimit - 3 }
      : { label: `${usage.credits.toLocaleString()} credits left`, warn: usage.credits < 20 }
    : null;
  const appVersion = packageJson.version;
  const filteredHistoryItems = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    if (!query) return historyItems;
    return historyItems.filter((item) =>
      `${item.title} ${item.snippet}`.toLowerCase().includes(query)
    );
  }, [historyItems, historySearch]);
  const pinLimitReached = historyItems.filter((item) => item.pinned).length >= 10;

  return (
    <main
      className="h-dvh min-h-dvh w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 flex flex-col overflow-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <section className="sr-only">
        <h1>Compare ChatGPT, Claude, Gemini, and Grok side by side</h1>
        <p>
          MultiAI is a four-panel AI comparison workspace for testing prompts across major AI brands in parallel.
          Send one prompt to multiple models, compare answers instantly, resize the layout, upload files, and generate images.
        </p>
      </section>
      {/* Top bar */}
      <form
        onSubmit={handleBroadcast}
        className="flex items-center gap-1.5 px-2 py-1 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-10 shrink-0"
      >
        <button
          type="button"
          onClick={() => setIsHistoryOpen((prev) => !prev)}
          className={`h-7 w-7 shrink-0 rounded-md border transition-colors ${
            isHistoryOpen
              ? 'border-purple-500/50 bg-purple-500/10 text-purple-500'
              : 'border-zinc-200 text-zinc-500 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100'
          }`}
          aria-label="Toggle history panel"
          title="History"
        >
          <PanelLeft size={14} className="mx-auto" />
        </button>

        {/* Logo */}
        <span className="font-bold text-xs bg-gradient-to-r from-blue-500 via-purple-500 to-orange-500 bg-clip-text text-transparent whitespace-nowrap select-none">
          MultiAI
        </span>

        {/* Broadcast input */}
        <input
          className="flex-1 h-7 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-0 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 transition-shadow"
          value={broadcastInput}
          onChange={(e) => setBroadcastInput(e.target.value)}
          placeholder="Send to all 4 AIs…"
        />
        <button
          type="submit"
          disabled={!broadcastInput.trim()}
          className="h-7 bg-gradient-to-r from-blue-500 via-purple-500 to-orange-500 text-white px-2 rounded-md text-[11px] font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center gap-1 whitespace-nowrap"
        >
          <Send size={11} />
          All 4
        </button>

        {/* Usage badge */}
        {planBadge && (
          <button
            type="button"
            onClick={() => setPaywall({ open: true, reason: usage?.plan === 'free' ? 'daily_limit' : 'no_credits', dailyCount: usage?.dailyCount, dailyLimit: usage?.dailyLimit })}
            className={`h-7 text-[11px] whitespace-nowrap transition-colors border rounded-md px-2 py-0 ${
              planBadge.warn
                ? 'text-amber-500 border-amber-500/40 hover:border-amber-400'
                : 'text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
          >
            {planBadge.label}
          </button>
        )}

        <a
          href="mailto:contact@merlintheai.com?subject=MultiAI%20feedback&body=Hi%20Merlin%20team,%0A%0AFeedback%20for%20MultiAI:%0A"
          title="Send feedback"
          className="h-7 w-7 shrink-0 rounded-md border border-zinc-200 text-zinc-500 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100 flex items-center justify-center transition-colors"
          aria-label="Send feedback"
        >
          <Mail size={14} />
        </a>

        {/* Account / sign-in button */}
        <button
          type="button"
          onClick={handleUserIconClick}
          title={usage?.loggedIn ? usage.email : 'Sign in'}
          className={`relative transition-colors rounded-full p-0.5 ${usage?.loggedIn ? 'text-purple-400 hover:text-purple-300' : 'text-zinc-400 hover:text-zinc-200'}`}
        >
          <User size={14} />
          {usage?.loggedIn && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-zinc-900" />
          )}
        </button>
      </form>

      {/* Chat grid */}
      <div ref={gridRef} className="relative flex-1 overflow-hidden">
        <HistoryPanel
          open={isHistoryOpen}
          loggedIn={loggedIn}
          email={usage?.email}
          items={filteredHistoryItems}
          search={historySearch}
          activeId={activeHistoryId}
          loading={historyLoading}
          deletingId={historyDeletingId}
          pinningId={historyPinningId}
          pinLimitReached={pinLimitReached}
          onClose={() => setIsHistoryOpen(false)}
          onSearchChange={setHistorySearch}
          onSelect={handleSelectHistory}
          onDelete={handleDeleteHistory}
          onTogglePin={handleTogglePin}
          onNewChat={() => clearWorkspace({ closeHistory: true })}
          onSignIn={() => setPaywall({ open: true, reason: 'no_user' })}
        />
        <PanelGroup groupRef={horizontalGroupRef} onLayoutChange={handleHorizontalLayoutChange} orientation="horizontal" className="h-full w-full">
          <Panel id="left" defaultSize={50} minSize={20}>
            <PanelGroup groupRef={leftVerticalGroupRef} onLayoutChange={handleVerticalLayoutChange} orientation="vertical">
              <Panel id="top" defaultSize={50} minSize={20}>
                <div className="h-full w-full bg-white dark:bg-zinc-950 border-r border-b border-zinc-200 dark:border-zinc-800">
                  <ChatWindow
                    ref={openaiRef}
                    provider="openai"
                    title="ChatGPT"
                    color="bg-emerald-600"
                    version={appVersion}
                    onPaywall={handlePaywallTrigger}
                    onMessageSent={refreshUsage}
                    onConversationChange={(snapshot) => handleProviderConversationChange('openai', snapshot)}
                  />
                </div>
              </Panel>
              <PanelResizeHandle className="h-1 w-full bg-zinc-200 dark:bg-zinc-800 hover:bg-blue-500 dark:hover:bg-blue-500 transition-colors cursor-row-resize z-10" />
              <Panel id="bottom" defaultSize={50} minSize={20}>
                <div className="h-full w-full bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800">
                  <ChatWindow
                    ref={xaiRef}
                    provider="xai"
                    title="Grok"
                    color="bg-zinc-900 dark:bg-zinc-800"
                    onPaywall={handlePaywallTrigger}
                    onMessageSent={refreshUsage}
                    onConversationChange={(snapshot) => handleProviderConversationChange('xai', snapshot)}
                  />
                </div>
              </Panel>
            </PanelGroup>
          </Panel>

          <PanelResizeHandle className="w-1 h-full bg-zinc-200 dark:bg-zinc-800 hover:bg-blue-500 dark:hover:bg-blue-500 transition-colors cursor-col-resize z-10" />

          <Panel id="right" defaultSize={50} minSize={20}>
            <PanelGroup groupRef={rightVerticalGroupRef} onLayoutChange={handleVerticalLayoutChange} orientation="vertical">
              <Panel id="top" defaultSize={50} minSize={20}>
                <div className="h-full w-full bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                  <ChatWindow
                    ref={anthropicRef}
                    provider="anthropic"
                    title="Claude"
                    color="bg-amber-600"
                    onPaywall={handlePaywallTrigger}
                    onMessageSent={refreshUsage}
                    onConversationChange={(snapshot) => handleProviderConversationChange('anthropic', snapshot)}
                  />
                </div>
              </Panel>
              <PanelResizeHandle className="h-1 w-full bg-zinc-200 dark:bg-zinc-800 hover:bg-blue-500 dark:hover:bg-blue-500 transition-colors cursor-row-resize z-10" />
              <Panel id="bottom" defaultSize={50} minSize={20}>
                <div className="h-full w-full bg-white dark:bg-zinc-950">
                  <ChatWindow
                    ref={googleRef}
                    provider="google"
                    title="Gemini"
                    color="bg-blue-600"
                    onPaywall={handlePaywallTrigger}
                    onMessageSent={refreshUsage}
                    onConversationChange={(snapshot) => handleProviderConversationChange('google', snapshot)}
                  />
                </div>
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
        <button
          type="button"
          aria-label="Resize all four panels"
          title="Drag to resize all four panels"
          onPointerDown={handleCenterPointerDown}
          className={`absolute z-20 h-5 w-5 rounded-full border border-white/40 bg-zinc-900/80 shadow-lg backdrop-blur-sm transition-colors ${
            isCenterDragging ? 'cursor-grabbing bg-blue-600' : 'cursor-move hover:bg-blue-600'
          }`}
          style={centerHandleStyle}
        >
          <span className="pointer-events-none block text-[10px] leading-none text-white">+</span>
        </button>
      </div>

      {paywall.open && (
        <PaywallModal
          onClose={() => { setPaywall({ open: false }); refreshUsage(); }}
          reason={paywall.reason}
          dailyCount={paywall.dailyCount ?? usage?.dailyCount}
          dailyLimit={paywall.dailyLimit ?? usage?.dailyLimit}
          loggedIn={usage?.loggedIn}
          email={usage?.email}
          plan={usage?.plan}
          credits={usage?.credits}
          onSignOut={handleSignOut}
        />
      )}

    </main>
  );
}
