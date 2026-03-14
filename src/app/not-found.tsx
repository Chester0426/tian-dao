"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FlaskConical, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4">
      <div className="animate-fade-in-up text-center">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-muted">
          <FlaskConical className="size-8 text-gold-dim" />
        </div>
        <h1 className="mb-2 font-display text-4xl">Page not found</h1>
        <p className="mb-8 max-w-md text-muted-foreground">
          The page you are looking for does not exist or has been moved. Let us
          get you back on track.
        </p>
        <Link href="/" className={cn(buttonVariants({ size: "lg" }), "gap-2")}>
          <ArrowLeft className="size-4" />
          Back to home
        </Link>
      </div>
    </main>
  );
}
