"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export default function FeedbackPage() {
  const { locale } = useI18n();
  const isZh = locale === "zh";
  const [category, setCategory] = useState<"bug" | "suggestion" | "other">("bug");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 2) {
      setError(isZh ? "主旨至少需要 2 個字" : "Title must be at least 2 characters");
      return;
    }
    if (content.trim().length < 5) {
      setError(isZh ? "內容至少需要 5 個字" : "Content must be at least 5 characters");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, title: title.trim(), content: content.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed");
        setSubmitting(false);
        return;
      }
      setSuccess(true);
      setTitle("");
      setContent("");
      setSubmitting(false);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold">
            {isZh ? "回報與建議" : "Report & Feedback"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isZh ? "你的意見是我們改進的動力" : "Your feedback helps us improve"}
          </p>
        </div>

        <Card className="scroll-surface">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Category */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {isZh ? "類型" : "Category"}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["bug", "suggestion", "other"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                        category === c
                          ? "border-spirit-gold bg-spirit-gold/10 text-spirit-gold"
                          : "border-border/40 text-muted-foreground hover:border-border"
                      }`}
                    >
                      {c === "bug" && (isZh ? "🐛 Bug 回報" : "🐛 Bug")}
                      {c === "suggestion" && (isZh ? "💡 建議" : "💡 Suggestion")}
                      {c === "other" && (isZh ? "📝 其他" : "📝 Other")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {isZh ? "主旨" : "Title"}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                  placeholder={isZh ? "簡短描述問題或建議" : "Brief summary"}
                  className="w-full rounded-lg border border-border/40 bg-muted/10 px-3 py-2 text-sm focus:outline-none focus:border-spirit-gold/60"
                />
                <p className="text-xs text-muted-foreground/60 mt-1 text-right">
                  {title.length} / 100
                </p>
              </div>

              {/* Content */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {isZh ? "詳細內容" : "Details"}
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={8}
                  maxLength={2000}
                  placeholder={isZh ? "請詳細描述你遇到的問題或建議..." : "Describe the issue or suggestion in detail..."}
                  className="w-full rounded-lg border border-border/40 bg-muted/10 px-3 py-2 text-sm focus:outline-none focus:border-spirit-gold/60"
                />
                <p className="text-xs text-muted-foreground/60 mt-1 text-right">
                  {content.length} / 2000
                </p>
              </div>

              {error && (
                <div className="rounded-lg border border-cinnabar/30 bg-cinnabar/10 px-3 py-2 text-sm text-cinnabar">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-lg border border-jade/30 bg-jade/10 px-3 py-2 text-sm text-jade">
                  {isZh ? "✓ 提交成功，感謝你的回饋！" : "✓ Submitted, thank you!"}
                </div>
              )}

              <Button type="submit" disabled={submitting} className="w-full seal-glow">
                {submitting ? (isZh ? "提交中..." : "Submitting...") : (isZh ? "提交" : "Submit")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
