import { GameLayout } from "@/components/game-layout";

export default function GameGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <GameLayout>{children}</GameLayout>;
}
