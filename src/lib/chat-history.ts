import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  ProviderChatSnapshot,
  ProviderId,
  StoredChatMessage,
  StoredLocalMessage,
  WorkspaceHistoryItem,
  WorkspaceHistoryProviders,
  WorkspaceHistorySummary,
  createEmptyProviders,
} from '@/lib/chat-history-types';

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'chat-history.json');
export const MAX_PINNED_CHATS = 10;

type HistoryStore = Record<string, WorkspaceHistoryItem[]>;

const PROVIDERS: ProviderId[] = ['openai', 'anthropic', 'google', 'xai'];

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readStore(): HistoryStore {
  ensureDir();
  if (!fs.existsSync(HISTORY_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')) as HistoryStore;
  } catch {
    return {};
  }
}

function writeStore(store: HistoryStore) {
  ensureDir();
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(store, null, 2));
}

function safeMessage(message: Partial<StoredChatMessage>): StoredChatMessage | null {
  if (!message.id || (message.role !== 'system' && message.role !== 'user' && message.role !== 'assistant')) {
    return null;
  }

  return {
    id: message.id,
    role: message.role,
    content: typeof message.content === 'string' ? message.content : undefined,
    parts: Array.isArray(message.parts)
      ? message.parts
        .map((part) => {
          if (!part || typeof part !== 'object' || !('type' in part)) return null;
          if (part.type === 'text') {
            return { type: 'text', text: typeof part.text === 'string' ? part.text : undefined } as const;
          }
          if (part.type === 'file') {
            return {
              type: 'file',
              mediaType: typeof part.mediaType === 'string' ? part.mediaType : undefined,
              url: typeof part.url === 'string' ? part.url : undefined,
              filename: typeof part.filename === 'string' ? part.filename : undefined,
            } as const;
          }
          return null;
        })
        .filter((part): part is NonNullable<typeof part> => part !== null)
      : undefined,
  };
}

function safeLocalMessage(message: Partial<StoredLocalMessage>): StoredLocalMessage | null {
  if (!message.id || (message.role !== 'user' && message.role !== 'assistant')) {
    return null;
  }

  return {
    id: message.id,
    role: message.role,
    text: typeof message.text === 'string' ? message.text : undefined,
    imageBase64: typeof message.imageBase64 === 'string' ? message.imageBase64 : undefined,
    imageMime: typeof message.imageMime === 'string' ? message.imageMime : undefined,
    isGenerating: Boolean(message.isGenerating),
    error: typeof message.error === 'string' ? message.error : undefined,
  };
}

export function sanitizeProviders(input: unknown): WorkspaceHistoryProviders {
  const raw = (input && typeof input === 'object') ? input as Partial<Record<ProviderId, ProviderChatSnapshot>> : {};
  const providers = createEmptyProviders();

  for (const provider of PROVIDERS) {
    const snapshot = raw[provider];
    providers[provider] = {
      messages: Array.isArray(snapshot?.messages)
        ? snapshot.messages
          .map((message) => safeMessage(message))
          .filter((message): message is StoredChatMessage => message !== null)
        : [],
      localMessages: Array.isArray(snapshot?.localMessages)
        ? snapshot.localMessages
          .map((message) => safeLocalMessage(message))
          .filter((message): message is StoredLocalMessage => message !== null)
        : [],
    };
  }

  return providers;
}

function extractTextFromMessage(message: StoredChatMessage | StoredLocalMessage) {
  if ('text' in message) return message.text?.trim() ?? '';
  const chatMessage = message as StoredChatMessage;
  const textParts = chatMessage.parts
    ?.filter((part) => part.type === 'text')
    .map((part) => part.text?.trim() ?? '')
    .filter(Boolean) ?? [];
  return (textParts.join(' ') || chatMessage.content || '').trim();
}

function deriveTitleAndSnippet(providers: WorkspaceHistoryProviders) {
  const texts: string[] = [];

  for (const provider of PROVIDERS) {
    const snapshot = providers[provider];
    for (const message of snapshot.messages) {
      if (message.role === 'user') texts.push(extractTextFromMessage(message));
    }
    for (const message of snapshot.localMessages) {
      if (message.role === 'user') texts.push(extractTextFromMessage(message));
    }
  }

  const combined = texts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const basis = combined || 'Untitled chat';

  return {
    title: basis.slice(0, 60),
    snippet: basis.slice(0, 160),
  };
}

function toSummary(item: WorkspaceHistoryItem): WorkspaceHistorySummary {
  return {
    id: item.id,
    title: item.title,
    snippet: item.snippet,
    pinned: Boolean(item.pinned),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function sortHistoryItems(items: WorkspaceHistoryItem[]) {
  return items.sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) {
      return a.pinned ? -1 : 1;
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

function countPinned(items: WorkspaceHistoryItem[]) {
  return items.filter((item) => item.pinned).length;
}

export function listHistory(userId: string): WorkspaceHistorySummary[] {
  const store = readStore();
  return sortHistoryItems(store[userId] ?? []).map(toSummary);
}

export function getHistory(userId: string, id: string): WorkspaceHistoryItem | null {
  const store = readStore();
  return store[userId]?.find((item) => item.id === id) ?? null;
}

export function upsertHistory(userId: string, id: string | undefined, providers: WorkspaceHistoryProviders): WorkspaceHistoryItem {
  const store = readStore();
  const items = store[userId] ?? [];
  const now = new Date().toISOString();
  const meta = deriveTitleAndSnippet(providers);
  const existing = id ? items.find((item) => item.id === id) : null;

  if (existing) {
    existing.providers = providers;
    existing.title = meta.title;
    existing.snippet = meta.snippet;
    existing.updatedAt = now;
    writeStore({ ...store, [userId]: sortHistoryItems(items) });
    return existing;
  }

  const created: WorkspaceHistoryItem = {
    id: crypto.randomUUID(),
    userId,
    title: meta.title,
    snippet: meta.snippet,
    pinned: false,
    createdAt: now,
    updatedAt: now,
    providers,
  };

  store[userId] = sortHistoryItems([created, ...items]);
  writeStore(store);
  return created;
}

export function deleteHistory(userId: string, id: string) {
  const store = readStore();
  const items = store[userId] ?? [];
  const nextItems = items.filter((item) => item.id !== id);
  store[userId] = nextItems;
  writeStore(store);
  return nextItems.length !== items.length;
}

export function setPinnedState(userId: string, id: string, pinned: boolean) {
  const store = readStore();
  const items = store[userId] ?? [];
  const target = items.find((item) => item.id === id);

  if (!target) {
    return { error: 'not_found' as const };
  }

  if (pinned && !target.pinned && countPinned(items) >= MAX_PINNED_CHATS) {
    return { error: 'pin_limit' as const };
  }

  target.pinned = pinned;
  store[userId] = sortHistoryItems(items);
  writeStore(store);
  return { item: target };
}
