"use client";

import { useState } from "react";
import { GameSidebar } from "./game-sidebar";

export function GameLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen ink-wash-bg ink-noise">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <GameSidebar open={sidebarOpen} onCloseAction={() => setSidebarOpen(false)} />

      <main className="flex-1 md:ml-56 lg:ml-60">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-20 flex h-12 items-center border-b border-border/30 bg-card/80 backdrop-blur-sm px-4 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border/40 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="開啟選單"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 4.5h12M3 9h12M3 13.5h12" />
            </svg>
          </button>
          <span className="ml-3 font-heading text-sm font-bold">仙途放置</span>
        </div>
        {children}
      </main>
    </div>
  );
}
