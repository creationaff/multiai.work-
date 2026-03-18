export type ProviderId = 'openai' | 'anthropic' | 'google' | 'xai';

export interface StoredTextPart {
  type: 'text';
  text?: string;
}

export interface StoredFilePart {
  type: 'file';
  mediaType?: string;
  url?: string;
  filename?: string;
}

export type StoredChatPart = StoredTextPart | StoredFilePart;

export interface StoredChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content?: string;
  parts?: StoredChatPart[];
}

export interface StoredLocalMessage {
  id: string;
  role: 'user' | 'assistant';
  text?: string;
  imageBase64?: string;
  imageMime?: string;
  isGenerating?: boolean;
  error?: string;
}

export interface ProviderChatSnapshot {
  messages: StoredChatMessage[];
  localMessages: StoredLocalMessage[];
}

export type WorkspaceHistoryProviders = Record<ProviderId, ProviderChatSnapshot>;

export interface WorkspaceHistoryItem {
  id: string;
  userId: string;
  title: string;
  snippet: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  providers: WorkspaceHistoryProviders;
}

export interface WorkspaceHistorySummary {
  id: string;
  title: string;
  snippet: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export function createEmptySnapshot(): ProviderChatSnapshot {
  return {
    messages: [],
    localMessages: [],
  };
}

export function createEmptyProviders(): WorkspaceHistoryProviders {
  return {
    openai: createEmptySnapshot(),
    anthropic: createEmptySnapshot(),
    google: createEmptySnapshot(),
    xai: createEmptySnapshot(),
  };
}

export function providersHaveContent(providers: WorkspaceHistoryProviders) {
  return Object.values(providers).some(
    (snapshot) => snapshot.messages.length > 0 || snapshot.localMessages.length > 0
  );
}
