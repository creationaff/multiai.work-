'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useRef, useEffect, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import { Send, Trash2, Paperclip, Camera, X, FileText, Image as ImageIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ProviderChatSnapshot, StoredChatMessage, StoredLocalMessage } from '@/lib/chat-history-types';

interface ChatWindowProps {
  provider: 'openai' | 'anthropic' | 'google' | 'xai';
  title: string;
  color: string;
  version?: string;
  onPaywall?: (reason: 'daily_limit' | 'no_credits' | 'no_user', dailyCount?: number, dailyLimit?: number) => void;
  onMessageSent?: () => void;
  onConversationChange?: (snapshot: ProviderChatSnapshot) => void;
}

export interface ChatWindowHandle {
  sendBroadcast: (text: string) => void;
  getSnapshot: () => ProviderChatSnapshot;
  loadSnapshot: (snapshot: ProviderChatSnapshot) => void;
  clearConversation: () => void;
}

interface AttachedFile {
  id: string;
  name: string;
  type: string;
  dataUrl: string;
  isImage: boolean;
}

const IMAGE_VERBS = /\b(generate|create|make|draw|paint|render|show|produce|design|illustrate)\b/i;
const IMAGE_NOUNS = /\b(image|photo|picture|pic|illustration|artwork|drawing|painting|portrait|logo|icon|poster|wallpaper|banner)\b/i;

const NATIVE_IMAGE_SUPPORT: Record<ChatWindowProps['provider'], boolean> = {
  openai: true,
  google: true,
  anthropic: false,
  xai: false,
};

function isImageRequest(text: string) {
  const normalized = text.trim().toLowerCase();
  return IMAGE_NOUNS.test(normalized) && (IMAGE_VERBS.test(normalized) || normalized.includes('show me'));
}

function getUnsupportedImageMessage(provider: ChatWindowProps['provider']) {
  if (provider === 'anthropic') {
    return 'Claude native image generation is not available here yet. Use ChatGPT or Gemini to compare real image output.';
  }
  return 'Grok native image generation is not available here yet. Use ChatGPT or Gemini to compare real image output.';
}

const IMAGE_MODEL_LABEL: Record<string, string> = {
  openai: 'GPT-5 Image Mini',
  google: 'Gemini Flash Image',
  anthropic: 'Claude image unavailable',
  xai: 'Grok image unavailable',
};

export const ChatWindow = forwardRef<ChatWindowHandle, ChatWindowProps>(
function ChatWindow({ provider, title, color, version, onPaywall, onMessageSent, onConversationChange }, ref) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [localMessages, setLocalMessages] = useState<StoredLocalMessage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const handleLimitResponse = useCallback((body: { error: string; reason?: string; dailyCount?: number; dailyLimit?: number }) => {
    onPaywall?.(body.reason as 'daily_limit' | 'no_credits' | 'no_user', body.dailyCount, body.dailyLimit);
  }, [onPaywall]);

  const [chatError, setChatError] = useState<string | null>(null);

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { provider },
    }),
    onError: (err) => {
      try {
        const body = JSON.parse((err as Error).message);
        if (body?.error === 'limit') {
          handleLimitResponse(body);
        } else {
          setChatError(body?.error ?? 'Something went wrong. Please try again.');
        }
      } catch {
        setChatError('Connection error. Please try again.');
      }
    },
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  const handleImageGeneration = useCallback(async (prompt: string) => {
    const userMsgId = `u-${Date.now()}`;
    const asstMsgId = `a-${Date.now()}`;

    if (!NATIVE_IMAGE_SUPPORT[provider]) {
      setLocalMessages((prev) => [
        ...prev,
        { id: userMsgId, role: 'user', text: prompt },
        { id: asstMsgId, role: 'assistant', text: getUnsupportedImageMessage(provider) },
      ]);
      return;
    }

    setLocalMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', text: prompt },
      { id: asstMsgId, role: 'assistant', isGenerating: true, text: `Generating with ${IMAGE_MODEL_LABEL[provider]}…` },
    ]);

    try {
      const res = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, provider }),
      });
      const data = await res.json();
      if ((res.status === 402 || res.status === 429) && data?.error === 'limit') {
        setLocalMessages((prev) => prev.filter((m) => m.id !== userMsgId && m.id !== asstMsgId));
        handleLimitResponse(data);
        return;
      }
      if (data.error) throw new Error(data.error);
      onMessageSent?.();
      setLocalMessages((prev) =>
        prev.map((m) =>
          m.id === asstMsgId
            ? { ...m, isGenerating: false, imageBase64: data.imageBase64, imageMime: data.mimeType, text: undefined }
            : m
        )
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Image generation failed';
      setLocalMessages((prev) =>
        prev.map((m) =>
          m.id === asstMsgId ? { ...m, isGenerating: false, error: msg, text: undefined } : m
        )
      );
    }
  }, [provider, handleLimitResponse, onMessageSent]);

  // Use a ref so useImperativeHandle always calls the latest version without re-creating the handle
  const handleImageGenerationRef = useRef(handleImageGeneration);
  const sendMessageRef = useRef(sendMessage);
  const onMessageSentRef = useRef(onMessageSent);
  handleImageGenerationRef.current = handleImageGeneration;
  sendMessageRef.current = sendMessage;
  onMessageSentRef.current = onMessageSent;

  const clearConversation = useCallback(() => {
    setMessages([]);
    setLocalMessages([]);
    setChatError(null);
  }, [setMessages]);

  useImperativeHandle(ref, () => ({
    sendBroadcast: (text: string) => {
      if (!text.trim()) return;
      setChatError(null);
      if (isImageRequest(text)) {
        handleImageGenerationRef.current(text);
      } else {
        sendMessageRef.current({ text });
        onMessageSentRef.current?.();
      }
    },
    getSnapshot: () => ({
      messages: messages as StoredChatMessage[],
      localMessages,
    }),
    loadSnapshot: (snapshot) => {
      setMessages(snapshot.messages as typeof messages);
      setLocalMessages(snapshot.localMessages);
      setChatError(null);
      setInput('');
      setAttachments([]);
    },
    clearConversation,
  }), [clearConversation, localMessages, messages, setMessages]);

  const processFiles = useCallback((files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setAttachments((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random()}`,
            name: file.name,
            type: file.type,
            dataUrl,
            isImage: file.type.startsWith('image/'),
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      processFiles(e.target.files);
      e.target.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = input.trim();
    if (!text && attachments.length === 0) return;
    setChatError(null);

    if (text && isImageRequest(text) && attachments.length === 0) {
      setInput('');
      handleImageGeneration(text);
      return;
    }

    const fileParts = attachments.map((a) => ({
      type: 'file' as const,
      mediaType: a.type || 'application/octet-stream',
      url: a.dataUrl,
      filename: a.name,
    }));

    sendMessage({
      text,
      files: fileParts.length > 0 ? fileParts : undefined,
    } as Parameters<typeof sendMessage>[0]);

    onMessageSent?.();
    setInput('');
    setAttachments([]);
  };

  // Drag and drop
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, localMessages]);

  // Merge chat messages + local image messages in order
  type AnyMessage =
    | { kind: 'chat'; msg: typeof messages[number] }
    | { kind: 'local'; msg: StoredLocalMessage };

  const allMessages: AnyMessage[] = [
    ...messages.map((m) => ({ kind: 'chat' as const, msg: m })),
    ...localMessages.map((m) => ({ kind: 'local' as const, msg: m })),
  ];

  const handleClearAll = () => {
    clearConversation();
  };

  const hasMessages = messages.length > 0 || localMessages.length > 0;

  useEffect(() => {
    onConversationChange?.({
      messages: messages as StoredChatMessage[],
      localMessages,
    });
  }, [localMessages, messages, onConversationChange]);

  return (
    <div
      ref={dropZoneRef}
      className={`flex flex-col h-full w-full bg-white dark:bg-zinc-950 relative transition-colors ${isDragging ? 'bg-blue-50 dark:bg-blue-950/30' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-20 flex items-center justify-center border-2 border-dashed border-blue-400 bg-blue-50/80 dark:bg-blue-950/60 rounded pointer-events-none">
          <p className="text-blue-500 font-semibold text-sm">Drop files here</p>
        </div>
      )}

      {/* Header */}
      <div className={`flex items-center justify-between px-2 py-0.5 ${color} text-white shrink-0 min-h-6`}>
        <h2 className="font-semibold text-[11px] leading-none truncate pr-2">{title}</h2>
        {hasMessages && (
          <button onClick={handleClearAll} title="Clear chat" className="opacity-70 hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/20 shrink-0">
            <Trash2 size={11} />
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {chatError && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300">
            {chatError}
          </div>
        )}
        {!hasMessages && (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 text-xs gap-1">
            <p>Start a conversation with {title}</p>
            <p className="text-zinc-400">Drop files or images anywhere</p>
          </div>
        )}

        {allMessages.map((item) => {
          if (item.kind === 'chat') {
            const m = item.msg;
            return (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm space-y-2 ${
                  m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                }`}>
                  {m.parts?.map((p, i) => {
                    if (p.type === 'text') {
                      if (m.role === 'assistant') {
                        return (
                          <ReactMarkdown
                            key={i}
                            remarkPlugins={[remarkGfm]}
                            components={{
                              p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                              code: ({ children, className }) => {
                                const isBlock = className?.includes('language-');
                                return isBlock ? (
                                  <pre className="bg-zinc-900 dark:bg-zinc-950 text-zinc-100 rounded-md p-3 overflow-x-auto text-xs my-2">
                                    <code>{children}</code>
                                  </pre>
                                ) : (
                                  <code className="bg-zinc-200 dark:bg-zinc-700 rounded px-1 py-0.5 text-xs font-mono">{children}</code>
                                );
                              },
                              ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 my-1">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 my-1">{children}</ol>,
                              li: ({ children }) => <li className="text-sm">{children}</li>,
                              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                              em: ({ children }) => <em className="italic">{children}</em>,
                              a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="underline opacity-80 hover:opacity-100">{children}</a>,
                              h1: ({ children }) => <h1 className="font-bold text-base mt-2 mb-1">{children}</h1>,
                              h2: ({ children }) => <h2 className="font-bold text-sm mt-2 mb-1">{children}</h2>,
                              h3: ({ children }) => <h3 className="font-semibold text-sm mt-1 mb-0.5">{children}</h3>,
                              blockquote: ({ children }) => <blockquote className="border-l-2 border-zinc-400 pl-3 opacity-80 my-1">{children}</blockquote>,
                              hr: () => <hr className="border-zinc-300 dark:border-zinc-600 my-2" />,
                            }}
                          >
                            {p.text ?? ''}
                          </ReactMarkdown>
                        );
                      }
                      return <p key={i} className="whitespace-pre-wrap">{p.text}</p>;
                    }
                    if (p.type === 'file') {
                      const fp = p as { type: 'file'; mediaType?: string; url?: string; filename?: string };
                      if (fp.mediaType?.startsWith('image/') && fp.url) {
                        return <img key={i} src={fp.url} alt={fp.filename ?? 'image'} className="max-w-full rounded-md max-h-48 object-contain" />;
                      }
                      return (
                        <div key={i} className="flex items-center gap-1.5 text-xs opacity-80">
                          <FileText size={12} /><span>{fp.filename ?? 'file'}</span>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            );
          }

          // Local image message
          const m = item.msg;
          return (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
              }`}>
                {m.isGenerating && (
                  <div className="flex items-center gap-2 text-zinc-500 animate-pulse">
                    <ImageIcon size={14} />
                    <span>{m.text}</span>
                  </div>
                )}
                {m.error && <p className="text-red-500 text-xs">{m.error}</p>}
                {m.imageBase64 && (
                  <div className="space-y-1">
                    <img
                      src={`data:${m.imageMime ?? 'image/png'};base64,${m.imageBase64}`}
                      alt="Generated"
                      className="max-w-full rounded-md"
                    />
                    <p className="text-xs opacity-60 text-right">{IMAGE_MODEL_LABEL[provider]}</p>
                  </div>
                )}
                {!m.isGenerating && !m.error && !m.imageBase64 && m.text && (
                  <p className="whitespace-pre-wrap">{m.text}</p>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-lg px-3 py-2 text-sm animate-pulse">Thinking…</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="px-2 pt-1.5 flex flex-wrap gap-1.5 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
          {attachments.map((a) => (
            <div key={a.id} className="relative group">
              {a.isImage ? (
                <img src={a.dataUrl} alt={a.name} className="h-12 w-12 object-cover rounded-md border border-zinc-200 dark:border-zinc-700" />
              ) : (
                <div className="h-12 w-12 flex flex-col items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-[10px] text-center px-1 gap-0.5">
                  <FileText size={14} />
                  <span className="truncate w-full text-center">{a.name.split('.').pop()?.toUpperCase()}</span>
                </div>
              )}
              <button onClick={() => removeAttachment(a.id)} className="absolute -top-1 -right-1 bg-zinc-900 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="px-1.5 py-1 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-1 items-end">
          <div className="flex flex-col items-center justify-end gap-0.5 shrink-0 min-w-6">
            <div className="flex items-center gap-0.5">
              <button type="button" onClick={() => fileInputRef.current?.click()} title="Attach file" className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors p-0.5 shrink-0">
                <Paperclip size={14} />
              </button>
              <button type="button" onClick={() => cameraInputRef.current?.click()} title="Take photo" className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors p-0.5 shrink-0">
                <Camera size={14} />
              </button>
            </div>
            {version && provider === 'openai' && (
              <span className="font-mono text-[9px] leading-none text-zinc-500 dark:text-zinc-500 select-none">
                v{version}
              </span>
            )}
          </div>
          <input
            className="flex-1 h-7 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-2 py-0 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 transition-shadow"
            value={input}
            placeholder="Type a message…"
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            disabled={isLoading || (!input.trim() && attachments.length === 0)}
            className="h-7 w-7 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center shrink-0"
          >
            <Send size={14} />
          </button>
        </form>
        <input ref={fileInputRef} type="file" multiple accept="image/*,application/pdf,.txt,.md,.csv,.json,.py,.js,.ts,.tsx,.jsx" className="hidden" onChange={handleFileChange} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
      </div>
    </div>
  );
});
