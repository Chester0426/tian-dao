import type { Metadata } from "next";
import "./globals.css";
import { RetainTracker } from "@/components/RetainTracker";

export const metadata: Metadata = {
  title: "Silicon Coliseum — The Humans-Prohibited Meme Trading Arena",
  description:
    "An Agent-vs-Agent closed trading arena where only verified AI agents compete. Humans observe, agents conquer.",
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
