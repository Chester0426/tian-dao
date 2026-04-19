import { Separator } from "@/components/ui/separator";

export default function Page() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <img src="/images/nav-items/nav-herbalism.png" alt="採藥" className="h-12 w-12 object-contain" />
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">採藥</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">即將開放</p>
        <Separator className="mt-4" />
      </header>
    </div>
  );
}
