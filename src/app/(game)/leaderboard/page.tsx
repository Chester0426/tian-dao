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
  "text-spirit-gold text-lg font-bold", // 1st
  "text-muted-foreground text-lg font-bold", // 2nd
  "text-amber-700 text-lg font-bold", // 3rd
];

interface Entry {
  rank: number;
  name: string;
  realm: string;
  level: number;
}

export default function LeaderboardPage() {
  const { locale } = useI18n();
  const isZh = locale === "zh";
  const [data, setData] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/game/leaderboard")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.leaderboard) setData(d.leaderboard); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
          {isZh ? "境界排名 · 前十名" : "Realm Ranking · Top 10"}
        </p>
        <Separator className="mt-4" />
      </header>

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
            const rd = REALM_DISPLAY[entry.realm] ?? REALM_DISPLAY["煉體"];
            const levelText = entry.level >= 9 && entry.realm === "煉體"
              ? (isZh ? "巔峰" : "Peak")
              : entry.level >= 13 && entry.realm === "練氣"
              ? (isZh ? "巔峰" : "Peak")
              : `${entry.level} ${isZh ? "級" : "Lv."}`;

            return (
              <div
                key={entry.rank}
                className={`flex items-center gap-4 rounded-lg border px-4 py-3 transition-colors ${
                  entry.rank <= 3 ? "border-spirit-gold/30 bg-spirit-gold/5" : "border-border/30 bg-muted/5"
                }`}
              >
                <span className={`w-8 text-center font-heading tabular-nums ${RANK_STYLE[entry.rank - 1] ?? "text-muted-foreground"}`}>
                  {entry.rank}
                </span>
                <span className="flex-1 font-heading text-sm truncate">{entry.name}</span>
                <span className={`text-sm font-heading ${rd.color}`}>
                  {isZh ? rd.zh : rd.en}
                </span>
                <span className="text-sm tabular-nums text-muted-foreground w-16 text-right">
                  {levelText}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
