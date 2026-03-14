"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function Error({
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
    <main className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4">
      <div className="animate-fade-in-up text-center">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-destructive/10">
          <AlertTriangle className="size-8 text-destructive" />
        </div>
        <h1 className="mb-2 font-display text-4xl">Something went wrong</h1>
        <p className="mb-8 max-w-md text-muted-foreground">
          An unexpected error occurred. Please try again, and if the problem
          persists, contact support.
        </p>
        <Button onClick={reset} size="lg" className="gap-2">
          <RotateCcw className="size-4" />
          Try again
        </Button>
      </div>
    </main>
  );
}
