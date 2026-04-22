"use client";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n";

export default function Page() {
  const { locale } = useI18n();
  const isZh = locale === "zh";
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <img src="/images/nav-items/nav-smithing.png" alt="" className="h-12 w-12 object-contain" />
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">{isZh ? "煉器" : "Smithing"}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{isZh ? "即將開放" : "Coming Soon"}</p>
        <p className="mt-3 text-sm text-muted-foreground/70">{isZh ? "未來將讓玩家可以利用礦物打造神兵" : "Forge divine weapons from ores"}</p>
        <Separator className="mt-4" />
      </header>
    </div>
  );
}
