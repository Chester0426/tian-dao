"use client";

import { GameSidebar } from "./game-sidebar";

export function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <GameSidebar />
      <main className="ml-56 flex-1 lg:ml-60">
        {children}
      </main>
    </div>
  );
}
