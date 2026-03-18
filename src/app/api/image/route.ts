// Image generation via OpenRouter chat completions with image-output models.
// We only use brand-native image models so the panels remain a true brand comparison.

import { NextRequest } from 'next/server';
import { verifySessionToken } from '@/lib/auth';
import { checkAndConsume, IMAGE_REQUEST_COST, Provider } from '@/lib/usage';

export const maxDuration = 90; // allow up to 90s for image generation

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? '';
const BASE = 'https://openrouter.ai/api/v1/chat/completions';

const IMAGE_MODELS: Partial<Record<Provider, string>> = {
  openai: 'openai/gpt-5-image-mini',
  google: 'google/gemini-2.5-flash-image',
};

function isProvider(value: unknown): value is Provider {
  return value === 'openai' || value === 'anthropic' || value === 'google' || value === 'xai';
}

export async function POST(req: NextRequest) {
  const { prompt, provider } = await req.json();
  if (!isProvider(provider)) {
    return Response.json({ error: 'Invalid provider' }, { status: 400 });
  }
  const session = req.cookies.get('session')?.value ?? '';
  const userId = verifySessionToken(session) ?? req.cookies.get('uid')?.value ?? '';
  if (!userId) {
    return Response.json({ error: 'limit', reason: 'no_user' }, { status: 402 });
  }
  const usage = await checkAndConsume(userId, IMAGE_REQUEST_COST);
  if (!usage.allowed) {
    return Response.json({ error: 'limit', reason: usage.reason, plan: usage.plan, dailyCount: usage.dailyCount, dailyLimit: usage.dailyLimit }, { status: 402 });
  }
  const model = IMAGE_MODELS[provider];

  if (!model) {
    return Response.json({
      error: provider === 'anthropic'
        ? 'Claude does not have native image generation here yet.'
        : 'Grok does not have native image generation here yet.',
    }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);

    const res = await fetch(BASE, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://multiai.work',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: `Generate an image: ${prompt}` }],
        modalities: ['text', 'image'],
      }),
    });
    clearTimeout(timeout);

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error?.message ?? `API error ${res.status}`);
    }

    const msg = data?.choices?.[0]?.message;
    const images: Array<{ type: string; image_url?: { url?: string } }> = msg?.images ?? [];

    if (images.length === 0) {
      throw new Error('No image returned by model');
    }

    const dataUrl = images[0]?.image_url?.url ?? '';
    // dataUrl is "data:image/png;base64,<b64>"
    const [header, imageBase64] = dataUrl.split(',');
    const mimeType = header.replace('data:', '').replace(';base64', '') || 'image/png';

    return Response.json({ imageBase64, mimeType });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Image generation failed';
    return Response.json({ error: message }, { status: 500 });
  }
}
