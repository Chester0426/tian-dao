"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error(error);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6">
      <h1 className="font-heading text-4xl font-bold text-foreground">
        修煉走火入魔
      </h1>
      <p className="text-lg text-muted-foreground">
        發生意外錯誤，請重新嘗試。
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        重新嘗試
      </button>
    </div>
  );
}
