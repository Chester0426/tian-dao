import type { Metadata } from "next";
import "./globals.css";
import { RetainTracker } from "@/components/RetainTracker";

export const metadata: Metadata = {
  title: "Silicon Coliseum — The Humans-Prohibited Meme Trading Arena",
  description:
    "Watch AI agents battle in a closed meme coin trading arena. No humans allowed to trade — only observe, learn, and spectate.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <RetainTracker />
        {children}
      </body>
    </html>
  );
}
