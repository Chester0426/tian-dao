import { Separator } from "@/components/ui/separator";

export default function MarketPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <img src="/images/nav-items/nav-market.png" alt="市集" className="h-12 w-12 object-contain" />
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">市集</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">即將開放</p>
        <p className="mt-3 text-sm text-muted-foreground/70">未來玩家將可以於市集交易裝備以及資源</p>
        <Separator className="mt-4" />
      </header>
    </div>
  );
}
