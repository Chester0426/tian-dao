"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useGameState } from "@/components/mining-provider";
import { useI18n } from "@/lib/i18n";
import { useState, useCallback } from "react";

// NAV_SECTIONS moved inside component to use translations

export function GameSidebar({
  open,
  onCloseAction,
  isAdmin = false,
}: {
  open: boolean;
  onCloseAction: () => void;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const gameState = useGameState();
  const { locale, setLocale, t } = useI18n();

  const NAV_SECTIONS = [
    { title: t("sidebar_items"), items: [
      { name: t("sidebar_shop"), href: "/shop", icon: "🏪", key: "shop" },
      { name: t("sidebar_inventory"), href: "/inventory", icon: "🎒", key: "inventory" },
    ]},
    { title: locale === "zh" ? "戰鬥" : "Combat", items: [
      { name: locale === "zh" ? "境界" : "Realm", href: "/dashboard", icon: "🧘", key: "body" },
      { name: locale === "zh" ? "數值" : "Stats", href: "/stats", icon: "📊", key: "stats" },
      { name: locale === "zh" ? "遊歷" : "Adventure", href: "/adventure", icon: "⚔️", key: "adventure" },
      { name: locale === "zh" ? "秘境" : "Dungeon", href: "/dungeon", icon: "🌀", key: "dungeon" },
    ]},
    { title: t("sidebar_skills"), items: [
      { name: locale === "zh" ? "參悟" : "Enlightenment", href: "/enlightenment", icon: "📜", key: "enlightenment" },
      { name: t("sidebar_mining"), href: "/mining", icon: "⛏️", key: "mining" },
      { name: locale === "zh" ? "採藥" : "Herbalism", href: "/herbalism", icon: "🌿", key: "herbalism" },
      ...((gameState.realm && gameState.realm !== "煉體") ? [
        { name: locale === "zh" ? "煉丹" : "Alchemy", href: "/alchemy", icon: "🧪", key: "alchemy" },
      ] : []),
      { name: locale === "zh" ? "烹飪" : "Cooking", href: "/cooking", icon: "🍳", key: "cooking" },
      { name: locale === "zh" ? "釣魚" : "Fishing", href: "/fishing", icon: "🎣", key: "fishing" },
      ...((gameState.realm && gameState.realm !== "煉體") ? [
        { name: locale === "zh" ? "煉器" : "Smithing", href: "/smithing", icon: "🔨", key: "smithing" },
      ] : []),
    ]},
    { title: locale === "zh" ? "系統" : "System", items: [
      { name: locale === "zh" ? "回報與建議" : "Feedback", href: "/feedback", icon: "📮", key: "feedback" },
      ...(isAdmin ? [{ name: locale === "zh" ? "回報管理" : "Manage Feedback", href: "/admin/feedback", icon: "🛡️", key: "admin-feedback" }] : []),
      { name: t("sidebar_switchChar"), href: "/characters", icon: "🔄", key: "switch-char" },
      { name: locale === "zh" ? "English" : "中文", href: "#lang", icon: "🌐", key: "lang-toggle" },
      { name: t("sidebar_logout"), href: "#logout", icon: "🚪", key: "logout" },
    ]},
  ];

  const slotsUsed = new Set(gameState.inventory.map((i) => i.item_type)).size;
  const totalSlots = 20; // TODO: read from profile

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleSection = useCallback((title: string) => {
    setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }));
  }, []);

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen w-56 flex-col border-r border-border/30 bg-card/80 backdrop-blur-sm lg:w-60 transition-transform duration-200 ${
        open ? "translate-x-0" : "-translate-x-full"
      } md:translate-x-0`}
    >
      {/* Brand — compact logo, links to landing page */}
      <Link href="/" className="flex shrink-0 items-center gap-2.5 border-b border-border/30 py-3 px-4 transition-opacity hover:opacity-80">
        <img src="/images/logo-dao.png" alt="天道" className="h-10 w-10 rounded-lg object-cover" />
        <span className="font-heading text-sm font-bold text-foreground tracking-widest">
          TIAN TAO
        </span>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section) => {
          const isCollapsed = collapsed[section.title] ?? false;
          return (
          <div key={section.title} className="mb-5">
            <button
              type="button"
              onClick={() => toggleSection(section.title)}
              className="mb-2 flex w-full items-center gap-2 px-2 group cursor-pointer"
            >
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {section.title}
              </span>
              <div className="h-px flex-1 bg-border/20" />
              <span className="text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
                {isCollapsed ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </span>
            </button>
            {!isCollapsed && (
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = !item.href.startsWith("#") && (
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href))
                );
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={(e) => {
                      if (item.key === "logout") {
                        e.preventDefault();
                        const supabase = createClient();
                        supabase.auth.signOut().then(() => {
                          document.cookie = "x-slot=; path=/; max-age=0";
                          router.push("/login");
                        });
                      } else if (item.key === "lang-toggle") {
                        e.preventDefault();
                        setLocale(locale === "zh" ? "en" : "zh");
                      } else if (item.key === "switch-char") {
                        document.cookie = "x-slot=; path=/; max-age=0";
                      }
                      onCloseAction();
                    }}
                    className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? "bg-cinnabar-dim/50 text-cinnabar border border-cinnabar/20"
                        : "text-muted-foreground hover:bg-muted/30 hover:text-foreground border border-transparent"
                    }`}
                  >
                    <span className="text-base leading-none">{item.icon}</span>
                    <span className="flex-1">{item.name}</span>
                    {item.key === "inventory" && (
                      <span className="text-sm tabular-nums text-muted-foreground/70">
                        {slotsUsed}/{totalSlots}
                      </span>
                    )}
                    {item.key === "shop" && (
                      <span className="text-sm tabular-nums text-spirit-gold">
                        🪙 0
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
            )}
          </div>
          );
        })}
      </nav>

      {/* Version */}
      <div className="shrink-0 px-3 py-2">
        <p className="px-3 text-[10px] text-muted-foreground/40">Tian Tao v0.1</p>
      </div>
    </aside>
  );
}
