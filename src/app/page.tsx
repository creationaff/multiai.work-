'use client';

import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { ChatWindow } from '@/components/ChatWindow';

export default function Home() {
  return (
    <main className="h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm z-10">
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <span className="bg-gradient-to-r from-blue-500 via-purple-500 to-orange-500 bg-clip-text text-transparent">
            Multi-AI Chat
          </span>
        </h1>
        <div className="text-sm text-zinc-500">
          ChatGPT • Grok • Claude • Gemini
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <PanelGroup orientation="horizontal" className="h-full w-full">
          {/* Left Column */}
          <Panel defaultSize={50} minSize={20}>
            <PanelGroup orientation="vertical">
              {/* Top Left: ChatGPT */}
              <Panel defaultSize={50} minSize={20}>
                <div className="h-full w-full bg-white dark:bg-zinc-950 border-r border-b border-zinc-200 dark:border-zinc-800">
                  <ChatWindow
                    provider="openai"
                    title="ChatGPT (GPT-5.2 Pro)"
                    color="bg-emerald-600"
                  />
                </div>
              </Panel>
              
              <PanelResizeHandle className="h-1 w-full bg-zinc-200 dark:bg-zinc-800 hover:bg-blue-500 dark:hover:bg-blue-500 transition-colors cursor-row-resize z-10" />
              
              {/* Bottom Left: Grok */}
              <Panel defaultSize={50} minSize={20}>
                <div className="h-full w-full bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800">
                  <ChatWindow
                    provider="xai"
                    title="Grok (Grok 3)"
                    color="bg-zinc-900 dark:bg-zinc-800"
                  />
                </div>
              </Panel>
            </PanelGroup>
          </Panel>

          <PanelResizeHandle className="w-1 h-full bg-zinc-200 dark:bg-zinc-800 hover:bg-blue-500 dark:hover:bg-blue-500 transition-colors cursor-col-resize z-10" />

          {/* Right Column */}
          <Panel defaultSize={50} minSize={20}>
            <PanelGroup orientation="vertical">
              {/* Top Right: Claude */}
              <Panel defaultSize={50} minSize={20}>
                <div className="h-full w-full bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                  <ChatWindow
                    provider="anthropic"
                    title="Claude (Sonnet 4.5)"
                    color="bg-amber-600"
                  />
                </div>
              </Panel>
              
              <PanelResizeHandle className="h-1 w-full bg-zinc-200 dark:bg-zinc-800 hover:bg-blue-500 dark:hover:bg-blue-500 transition-colors cursor-row-resize z-10" />
              
              {/* Bottom Right: Gemini */}
              <Panel defaultSize={50} minSize={20}>
                <div className="h-full w-full bg-white dark:bg-zinc-950">
                  <ChatWindow
                    provider="google"
                    title="Gemini (2.5 Pro)"
                    color="bg-blue-600"
                  />
                </div>
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>
    </main>
  );
}
