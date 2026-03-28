"use client";

import { useEffect, useState } from "react";

export function SingleTabGuard({ children }: { children: React.ReactNode }) {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;

    const channel = new BroadcastChannel("tiandao-session");

    // Announce this tab is active
    channel.postMessage({ type: "ping" });

    // Listen for other tabs
    channel.onmessage = (event) => {
      if (event.data.type === "ping") {
        // Another tab just opened — tell it to back off
        channel.postMessage({ type: "already-open" });
      }
      if (event.data.type === "already-open") {
        // This tab is the new one — block it
        setBlocked(true);
      }
    };

    return () => channel.close();
  }, []);

  if (blocked) {
    return (
      <div className="min-h-screen ink-wash-bg ink-noise flex items-center justify-center">
        <div className="text-center space-y-4 px-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-xl border border-cinnabar/30 bg-cinnabar-dim">
            <span className="font-heading text-3xl font-bold text-cinnabar">仙</span>
          </div>
          <h1 className="font-heading text-2xl font-bold">遊戲已在其他視窗開啟</h1>
          <p className="text-sm text-muted-foreground">
            天道僅允許同時開啟一個視窗。請關閉此頁面，或關閉另一個視窗後重新整理。
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-cinnabar px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-cinnabar/90 transition-colors"
          >
            重新整理
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
