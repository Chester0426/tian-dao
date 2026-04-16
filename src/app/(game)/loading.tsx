export default function GameLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 animate-pulse">
      <div className="h-8 w-40 bg-muted/30 rounded mb-2" />
      <div className="h-4 w-64 bg-muted/20 rounded mb-6" />
      <div className="h-px bg-border/30 mb-6" />
      <div className="space-y-4">
        <div className="h-40 bg-muted/15 rounded-lg" />
        <div className="h-32 bg-muted/15 rounded-lg" />
      </div>
    </div>
  );
}
