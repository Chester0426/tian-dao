import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6">
      <h1 className="font-heading text-4xl font-bold text-foreground">
        迷失方向
      </h1>
      <p className="text-lg text-muted-foreground">
        此路不通，修士請回。
      </p>
      <Link
        href="/"
        className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        返回仙途
      </Link>
    </div>
  );
}
