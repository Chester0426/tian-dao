import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">This page does not exist in the arena.</p>
      <Link href="/" className="underline">
        Back to the Coliseum
      </Link>
    </div>
  );
}
