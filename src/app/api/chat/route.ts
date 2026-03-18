import { streamText } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { NextRequest } from 'next/server';
import { verifySessionToken } from '@/lib/auth';
import { checkAndConsume, getChatRequestCost, getUsageSummary, Provider } from '@/lib/usage';

const xai = createOpenAI({
  baseURL: 'https://api.x.ai/v1',
  apiKey: process.env.XAI_API_KEY ?? '',
});

const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
});

const OPENROUTER_FAST_MODELS: Record<Provider, string> = {
  openai: 'openai/gpt-4o-mini',
  anthropic: 'anthropic/claude-3.5-haiku',
  google: 'google/gemini-2.0-flash-lite-001',
  xai: 'x-ai/grok-4-fast',
};

const OPENROUTER_PREMIUM_MODELS: Record<Provider, string> = {
  openai: 'openai/gpt-5.2-pro',
  anthropic: 'anthropic/claude-sonnet-4.6',
  google: 'google/gemini-2.5-pro-preview',
  xai: 'x-ai/grok-4',
};

const DIRECT_FAST_MODELS: Record<Provider, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-latest',
  google: 'gemini-2.0-flash-lite',
  xai: 'grok-2-1212',
};

const DIRECT_PREMIUM_MODELS: Record<Provider, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-3-5-sonnet-20241022',
  google: 'gemini-2.0-flash',
  xai: 'grok-2-vision-1212',
};

type RawPart =
  | { type: 'text'; text?: string }
  | { type: 'file'; mediaType?: string; url?: string; filename?: string }
  | { type: string };

type RawMessage = {
  role: string;
  content?: string;
  parts?: RawPart[];
};

function isProvider(value: unknown): value is Provider {
  return value === 'openai' || value === 'anthropic' || value === 'google' || value === 'xai';
}

function normalizeMessages(messages: RawMessage[]) {
  return messages.map((m) => {
    if (!m.parts || m.parts.length === 0) {
      return { role: m.role, content: m.content ?? '' };
    }

    // Build multi-part content array for vision-capable messages
    const contentParts: Array<
      | { type: 'text'; text: string }
      | { type: 'image'; image: string; mimeType?: string }
      | { type: 'file'; data: string; mimeType: string; filename?: string }
    > = [];

    for (const p of m.parts) {
      if (p.type === 'text') {
        const text = (p as { type: 'text'; text?: string }).text ?? '';
        if (text) contentParts.push({ type: 'text', text });
      } else if (p.type === 'file') {
        const fp = p as { type: 'file'; mediaType?: string; url?: string; filename?: string };
        const url = fp.url ?? '';
        const mimeType = fp.mediaType ?? 'application/octet-stream';
        // Extract base64 data from data URL
        const base64 = url.includes(',') ? url.split(',')[1] : url;
        if (mimeType.startsWith('image/')) {
          contentParts.push({ type: 'image', image: base64, mimeType });
        } else {
          contentParts.push({ type: 'file', data: base64, mimeType, filename: fp.filename });
        }
      }
    }

    // If only one text part, use simple string content for compatibility
    if (contentParts.length === 1 && contentParts[0].type === 'text') {
      return { role: m.role, content: contentParts[0].text };
    }

    return { role: m.role, content: contentParts };
  });
}

export async function POST(req: NextRequest) {
  const { messages, provider } = await req.json();
  if (!isProvider(provider)) {
    return new Response('Invalid provider', { status: 400 });
  }
  const session = req.cookies.get('session')?.value ?? '';
  const userId = verifySessionToken(session) ?? req.cookies.get('uid')?.value ?? '';
  if (!userId) {
    return Response.json({ error: 'limit', reason: 'no_user' }, { status: 402 });
  }
  const useOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);
  const hasFiles = Array.isArray(messages) && messages.some((m: RawMessage) =>
    Array.isArray(m.parts) && m.parts.some((p) => p.type === 'file')
  );
  const usageSummary = await getUsageSummary(userId);
  const usePremiumModels = usageSummary.plan !== 'free';
  const cost = getChatRequestCost(provider, { premium: usePremiumModels, hasFiles });
  const usage = await checkAndConsume(userId, cost);
  if (!usage.allowed) {
    return Response.json({ error: 'limit', reason: usage.reason, plan: usage.plan, dailyCount: usage.dailyCount, dailyLimit: usage.dailyLimit }, { status: 402 });
  }

  const modelMessages = normalizeMessages(messages);

  let model;

  if (useOpenRouter) {
    const modelId = usePremiumModels ? OPENROUTER_PREMIUM_MODELS[provider] : OPENROUTER_FAST_MODELS[provider];
    model = openrouter.chat(modelId);
  } else {
    switch (provider) {
      case 'openai':
        model = openai.chat(usePremiumModels ? DIRECT_PREMIUM_MODELS.openai : DIRECT_FAST_MODELS.openai);
        break;
      case 'anthropic':
        model = anthropic(usePremiumModels ? DIRECT_PREMIUM_MODELS.anthropic : DIRECT_FAST_MODELS.anthropic);
        break;
      case 'google':
        model = google(usePremiumModels ? DIRECT_PREMIUM_MODELS.google : DIRECT_FAST_MODELS.google);
        break;
      case 'xai':
        model = xai.chat(usePremiumModels ? DIRECT_PREMIUM_MODELS.xai : DIRECT_FAST_MODELS.xai);
        break;
      default:
        return new Response('Invalid provider', { status: 400 });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = streamText({ model, messages: modelMessages as any });
  return result.toUIMessageStreamResponse();
}
