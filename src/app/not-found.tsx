import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className="relative">
        {/* Decorative glow */}
        <div className="absolute inset-0 -z-10 rounded-full bg-gold/5 blur-3xl" />

        <h1 className="font-display text-8xl tracking-tight text-gold/40 md:text-9xl">
          404
        </h1>
        <div className="mt-4 space-y-2">
          <h2 className="font-display text-2xl tracking-tight md:text-3xl">
            Specimen not found
          </h2>
          <p className="mx-auto max-w-md text-muted-foreground">
            The page you are looking for does not exist, was moved, or the
            assay has already been completed.
          </p>
        </div>
        <div className="mt-8">
          <Link href="/" className="inline-flex">
            <Button className="bg-gold text-accent-foreground hover:bg-gold-bright">
              Return to the lab
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
