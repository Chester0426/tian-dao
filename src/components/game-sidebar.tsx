"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useGameState } from "@/components/mining-provider";

const NAV_SECTIONS = [
  {
    title: "物品",
    items: [
      { name: "商店", href: "/shop", icon: "🏪" },
      { name: "儲物袋", href: "/inventory", icon: "🎒" },
    ],
  },
  {
    title: "境界",
    items: [
      { name: "練體", href: "/dashboard", icon: "💪" },
    ],
  },
  {
    title: "技能",
    items: [
      { name: "挖礦", href: "/mining", icon: "⛏" },
    ],
  },
];

export function GameSidebar({
  open,
  onCloseAction,
}: {
  open: boolean;
  onCloseAction: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const gameState = useGameState();

  const slotsUsed = new Set(gameState.inventory.map((i) => i.item_type)).size;
  const totalSlots = 20; // TODO: read from profile

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen w-56 flex-col border-r border-border/30 bg-card/80 backdrop-blur-sm lg:w-60 transition-transform duration-200 ${
        open ? "translate-x-0" : "-translate-x-full"
      } md:translate-x-0`}
    >
      {/* Brand — large centered logo */}
      <div className="flex flex-col items-center gap-1 border-b border-border/30 py-4 px-4">
        <img src="/images/logo-dao.png" alt="天道" className="h-20 w-20 rounded-xl object-cover" />
        <span className="font-heading text-sm font-bold text-foreground tracking-widest">
          TIAN DAO
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-5">
            <div className="mb-2 flex items-center gap-2 px-2">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {section.title}
              </span>
              <div className="h-px flex-1 bg-border/20" />
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href.split("#")[0]));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={onCloseAction}
                    className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? "bg-cinnabar-dim/50 text-cinnabar border border-cinnabar/20"
                        : "text-muted-foreground hover:bg-muted/30 hover:text-foreground border border-transparent"
                    }`}
                  >
                    <span className="text-base leading-none">{item.icon}</span>
                    <span className="flex-1">{item.name}</span>
                    {item.name === "儲物袋" && (
                      <span className="text-sm tabular-nums text-muted-foreground/70">
                        {slotsUsed}/{totalSlots}
                      </span>
                    )}
                    {item.name === "商店" && (
                      <span className="text-sm tabular-nums text-spirit-gold">
                        🪙 0
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer — switch character + logout */}
      <div className="border-t border-border/30 px-3 py-3 space-y-1">
        <Link
          href="/characters"
          onClick={() => {
            // Clear slot cookie so middleware redirects properly
            document.cookie = "x-slot=; path=/; max-age=0";
            onCloseAction();
          }}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors"
        >
          <span className="text-base leading-none">🔄</span>
          <span>切換角色</span>
        </Link>
        <button
          onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signOut();
            document.cookie = "x-slot=; path=/; max-age=0";
            router.push("/login");
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors"
        >
          <span className="text-base leading-none">🚪</span>
          <span>登出</span>
        </button>
        <p className="px-3 text-[10px] text-muted-foreground/40">
          天道 v0.1
        </p>
      </div>
    </aside>
  );
}
