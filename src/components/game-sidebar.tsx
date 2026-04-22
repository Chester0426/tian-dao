"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useGameState } from "@/components/mining-provider";
import { useI18n } from "@/lib/i18n";
import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// NAV_SECTIONS moved inside component to use translations

export function GameSidebar({
  open,
  onCloseAction,
  isAdmin = false,
  activeTab,
  onTabChangeAction,
}: {
  open: boolean;
  onCloseAction: () => void;
  isAdmin?: boolean;
  activeTab?: string;
  onTabChangeAction?: (tab: string) => void;
}) {
  const router = useRouter();
  const gameState = useGameState();
  const { locale, setLocale, t } = useI18n();

  const NAV_SECTIONS = [
    { title: locale === "zh" ? "外事" : "Affairs", items: [
      { name: t("sidebar_shop"), href: "/shop", icon: "🏪", iconUrl: "/images/nav-items/nav-shop.png", key: "shop", pcBgImage: "/images/bg-shop.png", mobileBgImage: "/images/bg-shop-m.png" },
      { name: locale === "zh" ? "市集" : "Market", href: "/market", icon: "🏛️", iconUrl: "/images/nav-items/nav-market.png", key: "market", pcBgImage: "/images/bg-market.png", mobileBgImage: "/images/bg-market-m.png" },
      { name: t("sidebar_inventory"), href: "/inventory", icon: "🎒", iconUrl: "/images/nav-items/nav-inventory.png", key: "inventory", pcBgImage: "/images/bg-inventory.png", mobileBgImage: "/images/bg-inventory-m.png" },
      { name: locale === "zh" ? "排行榜" : "Leaderboard", href: "/leaderboard", icon: "🏆", iconUrl: "/images/nav-items/nav-leaderboard.png", key: "leaderboard", pcBgImage: "/images/bg-leaderboard.png", mobileBgImage: "/images/bg-leaderboard-m.png" },
    ]},
    { title: locale === "zh" ? "修行" : "Cultivation", items: [
      { name: locale === "zh" ? "境界" : "Realm", href: "/dashboard", icon: "🧘", iconUrl: "/images/nav-items/nav-dashboard.png", key: "body", pcBgImage: "/images/bg-dashboard.png", mobileBgImage: "/images/bg-dashboard-m.png" },
      { name: locale === "zh" ? "數值" : "Stats", href: "/stats", icon: "📊", iconUrl: "/images/nav-items/nav-stats.png", key: "stats", pcBgImage: "/images/bg-stats.png", mobileBgImage: "/images/bg-stats-m.png" },
      { name: locale === "zh" ? "參悟" : "Enlightenment", href: "/enlightenment", icon: "📜", iconUrl: "/images/nav-items/nav-enlightenment.png", key: "enlightenment", pcBgImage: "/images/bg-enlightenment.png", mobileBgImage: "/images/bg-enlightenment-m.png" },
    ]},
    { title: locale === "zh" ? "戰鬥" : "Combat", items: [
      { name: locale === "zh" ? "遊歷" : "Adventure", href: "/adventure", icon: "⚔️", iconUrl: "/images/nav-items/nav-adventure.png", key: "adventure", pcBgImage: "/images/bg-adventure.png", mobileBgImage: "/images/bg-adventure-m.png" },
      { name: locale === "zh" ? "秘境" : "Dungeon", href: "/dungeon", icon: "🌀", iconUrl: "/images/nav-items/nav-dungeon.png", key: "dungeon", pcBgImage: "/images/bg-dungeon.png", mobileBgImage: "/images/bg-dungeon-m.png" },
    ]},
    { title: t("sidebar_skills"), items: [
      { name: t("sidebar_mining"), href: "/mining", icon: "⛏️", iconUrl: "/images/nav-items/nav-mining.png", key: "mining", pcBgImage: "/images/bg-mining.png", mobileBgImage: "/images/bg-mining-m.png" },
      { name: locale === "zh" ? "採藥" : "Herbalism", href: "/herbalism", icon: "🌿", iconUrl: "/images/nav-items/nav-herbalism.png", key: "herbalism", pcBgImage: "/images/bg-herbalism.png", mobileBgImage: "/images/bg-herbalism-m.png" },
      ...((gameState.realm && gameState.realm !== "煉體") ? [
        { name: locale === "zh" ? "煉丹" : "Alchemy", href: "/alchemy", icon: "🧪", iconUrl: "/images/nav-items/nav-alchemy.png", key: "alchemy", pcBgImage: "/images/bg-alchemy.png", mobileBgImage: "/images/bg-alchemy-m.png" },
        { name: locale === "zh" ? "煉器" : "Smithing", href: "/smithing", icon: "🔨", iconUrl: "/images/nav-items/nav-smithing.png", key: "smithing", pcBgImage: "/images/bg-smithing.png", mobileBgImage: "/images/bg-smithing-m.png" },
      ] : []),
    ]},
    { title: locale === "zh" ? "系統" : "System", items: [
      { name: locale === "zh" ? "回報與建議" : "Feedback", href: "/feedback", icon: "📮", iconUrl: "/images/nav-items/nav-feedback.png", key: "feedback" },
      ...(isAdmin ? [{ name: locale === "zh" ? "回報管理" : "Manage Feedback", href: "/admin/feedback", icon: "🛡️", key: "admin-feedback" }] : []),
      { name: t("sidebar_switchChar"), href: "/characters", icon: "🔄", iconUrl: "/images/nav-items/nav-switch-char.png", key: "switch-char" },
      { name: locale === "zh" ? "更改角色名稱" : "Rename Character", href: "#rename", icon: "✏️", iconUrl: "/images/nav-items/nav-rename.png", key: "rename" },
      { name: locale === "zh" ? "English" : "中文", href: "#lang", icon: "🌐", iconUrl: "/images/nav-items/nav-lang-toggle.png", key: "lang-toggle" },
      { name: t("sidebar_logout"), href: "#logout", icon: "🚪", iconUrl: "/images/nav-items/nav-logout.png", key: "logout" },
    ]},
  ];

  const slotsUsed = new Set(gameState.inventory.map((i) => i.item_type)).size;
  const totalSlots = 20; // TODO: read from profile

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameError, setRenameError] = useState("");
  const [renaming, setRenaming] = useState(false);
  const toggleSection = useCallback((title: string) => {
    setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }));
  }, []);

  return (
    <>
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen w-56 flex-col border-r border-border/30 bg-transparent lg:w-60 transition-transform duration-200 ${
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
                return (
                  item.href.startsWith("#") || item.key === "switch-char" ? (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={(e) => {
                        if (item.key === "rename") {
                          e.preventDefault();
                          setNewName("");
                          setRenameError("");
                          setRenameOpen(true);
                        } else if (item.key === "logout") {
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
                      className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 text-muted-foreground hover:bg-muted/30 hover:text-foreground border border-transparent`}
                    >
                      {item.iconUrl ? (
                        <img src={item.iconUrl} alt={item.name} className="h-5 w-5 object-contain" />
                      ) : (
                        <span className="text-base leading-none">{item.icon}</span>
                      )}
                      <span className="flex-1">{item.name}</span>
                    </Link>
                  ) : (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => {
                        const tab = item.href.replace("/", "");
                        if (onTabChangeAction) onTabChangeAction(tab);
                        onCloseAction();
                      }}
                      className={`w-full group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                        activeTab === item.href.replace("/", "")
                          ? "bg-cinnabar-dim/50 text-cinnabar border border-cinnabar/20"
                          : "text-muted-foreground hover:bg-muted/30 hover:text-foreground border border-transparent"
                      }`}
                    >
                      {item.iconUrl ? (
                        <img src={item.iconUrl} alt={item.name} className="h-5 w-5 object-contain" />
                      ) : (
                        <span className="text-base leading-none">{item.icon}</span>
                      )}
                      <span className="flex-1 text-left">{item.name}</span>
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
                    </button>
                  )
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

    {/* Rename dialog */}
    <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
      <DialogContent className="scroll-surface sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">{locale === "zh" ? "更改角色名稱" : "Rename Character"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            {locale === "zh" ? "支援中文、日文、英文，1-12 字元" : "Supports Chinese, Japanese, English. 1-12 characters."}
          </p>
          <input
            type="text"
            value={newName}
            onChange={(e) => { setNewName(e.target.value); setRenameError(""); }}
            placeholder={locale === "zh" ? "輸入新名稱" : "Enter new name"}
            maxLength={12}
            className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-jade/30 focus:border-jade/40"
            autoComplete="off"
          />
          {renameError && <p className="text-xs text-cinnabar">{renameError}</p>}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setRenameOpen(false)}>
              {locale === "zh" ? "取消" : "Cancel"}
            </Button>
            <Button
              className="flex-1 seal-glow"
              disabled={!newName.trim() || renaming}
              onClick={async () => {
                setRenaming(true);
                setRenameError("");
                try {
                  const res = await fetch("/api/game/rename", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: newName.trim() }),
                  });
                  const data = await res.json();
                  if (!res.ok) {
                    setRenameError(data.error ?? (locale === "zh" ? "更改失敗" : "Failed"));
                  } else {
                    setRenameOpen(false);
                  }
                } catch {
                  setRenameError(locale === "zh" ? "網路錯誤" : "Network error");
                } finally {
                  setRenaming(false);
                }
              }}
            >
              {renaming ? (locale === "zh" ? "更改中..." : "Saving...") : (locale === "zh" ? "確認" : "Confirm")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
