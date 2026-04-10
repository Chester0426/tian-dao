"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface FeedbackItem {
  id: string;
  user_id: string;
  user_email: string | null;
  category: "bug" | "suggestion" | "other";
  title: string;
  content: string;
  status: string;
  created_at: string;
}

export default function AdminFeedbackPage() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/feedback")
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed");
        }
        return res.json();
      })
      .then((data) => {
        setItems(data.feedback ?? []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const maskEmail = (email: string | null) => {
    if (!email) return "(unknown)";
    const [local, domain] = email.split("@");
    if (!local || !domain) return email;
    const masked = local.length <= 3 ? local[0] + "***" : local.slice(0, 3) + "***";
    return `${masked}@${domain}`;
  };

  const categoryBadge = (cat: string) => {
    if (cat === "bug") return <Badge className="bg-cinnabar/20 text-cinnabar border-cinnabar/30">🐛 Bug</Badge>;
    if (cat === "suggestion") return <Badge className="bg-spirit-gold/20 text-spirit-gold border-spirit-gold/30">💡 建議</Badge>;
    return <Badge className="bg-muted/30 text-muted-foreground">📝 其他</Badge>;
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold">回報管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            共 {items.length} 筆回報
          </p>
        </div>

        {loading && <p className="text-muted-foreground">載入中...</p>}
        {error && (
          <Card className="scroll-surface">
            <CardContent className="pt-6">
              <p className="text-cinnabar">錯誤：{error}</p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="scroll-surface">
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {categoryBadge(item.category)}
                    <span className="text-xs text-muted-foreground">
                      {maskEmail(item.user_email)}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground/60">
                    {new Date(item.created_at).toLocaleString("zh-TW")}
                  </span>
                </div>
                {item.title && (
                  <h3 className="font-heading text-base font-semibold text-ink">{item.title}</h3>
                )}
                <p className="text-sm whitespace-pre-wrap">{item.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {!loading && items.length === 0 && (
          <Card className="scroll-surface">
            <CardContent className="pt-6 text-center text-muted-foreground">
              還沒有任何回報
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
