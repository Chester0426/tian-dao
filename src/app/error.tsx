"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className="relative">
        <div className="absolute inset-0 -z-10 rounded-full bg-verdict-kill/5 blur-3xl" />

        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-verdict-kill/10">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-8 w-8 text-verdict-kill"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <div className="mt-6 space-y-2">
          <h2 className="font-display text-2xl tracking-tight md:text-3xl">
            Something went wrong
          </h2>
          <p className="mx-auto max-w-md text-muted-foreground">
            An unexpected error occurred while processing your request. Our
            instruments have logged the anomaly.
          </p>
        </div>

        <div className="mt-8 flex items-center justify-center gap-3">
          <Button
            onClick={reset}
            className="bg-gold text-accent-foreground hover:bg-gold-bright"
          >
            Try again
          </Button>
          <a href="/">
            <Button variant="outline">
              Return home
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
