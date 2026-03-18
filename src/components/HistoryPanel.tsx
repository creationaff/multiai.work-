'use client';

import { Loader2, LogIn, MessageSquare, PanelLeftClose, Pin, Plus, Search, Trash2, X } from 'lucide-react';
import { WorkspaceHistorySummary } from '@/lib/chat-history-types';

interface HistoryPanelProps {
  open: boolean;
  loggedIn: boolean;
  email?: string;
  items: WorkspaceHistorySummary[];
  search: string;
  activeId: string | null;
  loading: boolean;
  deletingId: string | null;
  pinningId: string | null;
  pinLimitReached: boolean;
  onClose: () => void;
  onSearchChange: (value: string) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onNewChat: () => void;
  onSignIn: () => void;
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function HistoryPanel({
  open,
  loggedIn,
  email,
  items,
  search,
  activeId,
  loading,
  deletingId,
  pinningId,
  pinLimitReached,
  onClose,
  onSearchChange,
  onSelect,
  onDelete,
  onTogglePin,
  onNewChat,
  onSignIn,
}: HistoryPanelProps) {
  const pinnedCount = items.filter((item) => item.pinned).length;

  return (
    <>
      <div
        className={`absolute inset-0 z-30 bg-black/40 transition-opacity ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />
      <aside
        className={`absolute inset-y-0 left-0 z-40 w-80 max-w-[88vw] border-r border-zinc-200 bg-white shadow-2xl transition-transform dark:border-zinc-800 dark:bg-zinc-950 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">History</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{loggedIn ? (email ?? 'Signed in') : 'Sign in to save chats'}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              aria-label="Close history panel"
            >
              <PanelLeftClose size={16} />
            </button>
          </div>

          <div className="border-b border-zinc-200 p-3 dark:border-zinc-800">
            <button
              type="button"
              onClick={onNewChat}
              className="mb-3 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Plus size={15} />
              New chat
            </button>
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
              <Search size={15} className="shrink-0 text-zinc-400" />
              <input
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search previous chats"
                className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-400"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="rounded p-0.5 text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {loggedIn && (
              <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                Pinned chats: {pinnedCount}/10
                {pinLimitReached ? ' - unpin one to add another' : ''}
              </p>
            )}
          </div>

          {!loggedIn ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <div className="mb-3 rounded-full bg-zinc-100 p-3 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                <LogIn size={20} />
              </div>
              <p className="mb-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">Save chats to your account</p>
              <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
                Sign in to sync history across devices, search previous chats, and delete old sessions.
              </p>
              <button
                type="button"
                onClick={onSignIn}
                className="rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Sign in
              </button>
            </div>
          ) : loading ? (
            <div className="flex flex-1 items-center justify-center text-zinc-500 dark:text-zinc-400">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <div className="mb-3 rounded-full bg-zinc-100 p-3 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                <MessageSquare size={20} />
              </div>
              <p className="mb-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">No saved chats yet</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Start chatting and your workspace will autosave here.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`group mb-2 rounded-xl border transition-colors ${
                    activeId === item.id
                      ? 'border-purple-500/60 bg-purple-500/8'
                      : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className="block w-full px-3 py-3 text-left"
                  >
                    <div className="mb-1 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.title}</p>
                        {item.pinned && (
                          <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-purple-500">Pinned</p>
                        )}
                      </div>
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-zinc-400">
                        {formatDate(item.updatedAt)}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {item.snippet || 'Untitled chat'}
                    </p>
                  </button>
                  <div className="flex items-center gap-3 px-3 pb-3">
                    <button
                      type="button"
                      onClick={() => onTogglePin(item.id, !item.pinned)}
                      disabled={pinningId === item.id || (!item.pinned && pinLimitReached)}
                      className={`flex items-center gap-1.5 text-xs transition-colors disabled:opacity-50 ${
                        item.pinned ? 'text-purple-500 hover:text-purple-400' : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                      }`}
                    >
                      {pinningId === item.id ? <Loader2 size={12} className="animate-spin" /> : <Pin size={12} />}
                      {item.pinned ? 'Unpin' : 'Pin'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="flex items-center gap-1.5 text-xs text-zinc-400 transition-colors hover:text-red-500 disabled:opacity-50"
                    >
                      {deletingId === item.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
