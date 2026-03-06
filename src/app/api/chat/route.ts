import { streamText } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

const xai = createOpenAI({
  baseURL: 'https://api.x.ai/v1',
  apiKey: process.env.XAI_API_KEY ?? '',
});

const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
});

export async function POST(req: Request) {
  const { messages, provider } = await req.json();
  const useOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);

  let model;

  if (useOpenRouter) {
    switch (provider) {
      case 'openai':
        model = openrouter('openai/gpt-5.2-pro');
        break;
      case 'anthropic':
        model = openrouter('anthropic/claude-sonnet-4.5');
        break;
      case 'google':
        model = openrouter('google/gemini-2.5-pro-preview');
        break;
      case 'xai':
        model = openrouter('x-ai/grok-3');
        break;
      default:
        return new Response('Invalid provider', { status: 400 });
    }
  } else {
    switch (provider) {
      case 'openai':
        model = openai('gpt-4o');
        break;
      case 'anthropic':
        model = anthropic('claude-3-7-sonnet-latest');
        break;
      case 'google':
        model = google('gemini-2.5-pro');
        break;
      case 'xai':
        model = xai('grok-2-latest');
        break;
      default:
        return new Response('Invalid provider', { status: 400 });
    }
  }

  const result = streamText({
    model,
    messages,
  });

  return result.toTextStreamResponse();
}
