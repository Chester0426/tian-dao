"use client";

import { useState, useEffect } from "react";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n";

const REALM_DISPLAY: Record<string, { zh: string; en: string; color: string }> = {
  "煉體": { zh: "煉體期", en: "Body Refining", color: "text-spirit-gold" },
  "練氣": { zh: "練氣期", en: "Qi Condensation", color: "text-jade" },
  "築基": { zh: "築基期", en: "Foundation", color: "text-blue-400" },
  "金丹": { zh: "金丹期", en: "Golden Core", color: "text-purple-400" },
  "元嬰": { zh: "元嬰期", en: "Nascent Soul", color: "text-cinnabar" },
};

const RANK_STYLE = [
  "text-spirit-gold text-lg font-bold",
  "text-muted-foreground text-lg font-bold",
  "text-amber-700 text-lg font-bold",
];

const TABS = [
  { key: "realm", zh: "境界", en: "Realm" },
  { key: "mining", zh: "挖礦", en: "Mining" },
  { key: "body", zh: "煉體", en: "Body" },
  { key: "tao", zh: "天道值", en: "TAO Points" },
];

interface Entry {
  rank: number;
  name: string;
  realm?: string;
  level: number;
  isMe?: boolean;
}

export default function LeaderboardPage() {
  const { locale } = useI18n();
  const isZh = locale === "zh";
  const [activeTab, setActiveTab] = useState("realm");
  const [cache, setCache] = useState<Record<string, Entry[]>>({});
  const [loading, setLoading] = useState(true);

  // Prefetch all tabs on mount
  useEffect(() => {
    const types = ["realm", "mining", "body"];
    Promise.all(types.map((t) =>
      fetch(`/api/game/leaderboard?type=${t}`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => ({ type: t, data: d?.leaderboard ?? [] }))
        .catch(() => ({ type: t, data: [] }))
    )).then((results) => {
      const c: Record<string, Entry[]> = {};
      for (const r of results) c[r.type] = r.data;
      setCache(c);
      setLoading(false);
    });
  }, []);

  const data = cache[activeTab] ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <img src="/images/nav-items/nav-leaderboard.png" alt="" className="h-12 w-12 object-contain" />
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            {isZh ? "排行榜" : "Leaderboard"}
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {isZh ? "修煉之路，誰與爭鋒" : "The path of cultivation — who stands at the peak?"}
        </p>
        <Separator className="mt-4" />
      </header>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-6 py-3 rounded-lg text-base font-heading font-bold transition-all backdrop-blur-md ${
              activeTab === tab.key
                ? "text-spirit-gold border-2 border-spirit-gold"
                : "text-foreground/70 border-2 border-foreground/20 hover:text-foreground hover:border-foreground/40"
            }`}
            style={{
              background: activeTab === tab.key
                ? "rgba(212,166,67,0.2)"
                : "rgba(15,15,15,0.5)",
            }}
          >
            {isZh ? tab.zh : tab.en}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-muted/20 rounded-lg" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{isZh ? "尚無排名資料" : "No ranking data yet"}</p>
      ) : (
        <div className="space-y-2">
          {data.map((entry) => {
            const rd = entry.realm ? REALM_DISPLAY[entry.realm] : null;

            return (
              <div
                key={entry.rank}
                className={`flex items-center gap-4 rounded-lg border px-4 py-3 transition-colors backdrop-blur-md ${
                  entry.isMe ? "border-jade/50 ring-1 ring-jade/30" : entry.rank <= 3 ? "border-spirit-gold/30" : "border-border/30"
                }`}
                style={{ background: "rgba(15,15,15,0.5)" }}
              >
                <span className={`w-8 text-center font-heading tabular-nums ${RANK_STYLE[entry.rank - 1] ?? "text-muted-foreground"}`}>
                  {entry.rank}
                </span>
                <span className={`flex-1 font-heading text-sm truncate ${entry.isMe ? "text-jade" : ""}`}>
                  {entry.name}{entry.isMe ? (isZh ? " (你)" : " (You)") : ""}
                </span>
                {rd && (
                  <span className={`text-sm font-heading ${rd.color}`}>
                    {isZh ? rd.zh : rd.en}
                  </span>
                )}
                <span className="text-sm tabular-nums text-muted-foreground w-20 text-right">
                  {activeTab === "tao"
                    ? `🪙 ${entry.level.toLocaleString()}`
                    : activeTab === "realm" && entry.level >= 9 && entry.realm === "煉體"
                    ? (isZh ? "巔峰" : "Peak")
                    : activeTab === "realm" && entry.level >= 13 && entry.realm === "練氣"
                    ? (isZh ? "巔峰" : "Peak")
                    : `Lv.${entry.level}`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
