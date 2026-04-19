import { Separator } from "@/components/ui/separator";

export default function Page() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">煉器</h1>
        <p className="mt-1 text-sm text-muted-foreground">即將開放</p>
        <Separator className="mt-4" />
      </header>
    </div>
  );
}
