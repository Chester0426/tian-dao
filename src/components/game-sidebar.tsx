"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_SECTIONS = [
  {
    title: "修仙",
    items: [
      { name: "總覽", href: "/dashboard", icon: "🏠" },
      { name: "練體", href: "/dashboard", icon: "⚡", badge: "境界" },
    ],
  },
  {
    title: "生活技能",
    items: [
      { name: "挖礦", href: "/mining", icon: "⛏" },
    ],
  },
  {
    title: "其他",
    items: [
      { name: "背包", href: "/inventory", icon: "🎒" },
      { name: "商店", href: "/shop", icon: "🏪" },
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

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen w-56 flex-col border-r border-border/30 bg-card/80 backdrop-blur-sm lg:w-60 transition-transform duration-200 ${
        open ? "translate-x-0" : "-translate-x-full"
      } md:translate-x-0`}
    >
      {/* Brand */}
      <div className="flex h-14 items-center gap-2 border-b border-border/30 px-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-md border border-cinnabar/30 bg-cinnabar-dim font-heading text-sm font-bold text-cinnabar">
          仙
        </span>
        <span className="font-heading text-base font-bold text-foreground">
          仙途放置
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-5">
            <div className="mb-2 flex items-center gap-2 px-2">
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
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
                    {item.badge && (
                      <span className="text-[10px] text-muted-foreground/50">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border/30 px-4 py-3">
        <p className="text-[10px] text-muted-foreground/40">
          仙途放置 v0.1
        </p>
      </div>
    </aside>
  );
}
