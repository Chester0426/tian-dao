"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";

interface MiningStatus {
  isMining: boolean;
  mineId: string | null;
}

interface MiningContextValue {
  isMining: boolean;
  startMining: (mineId: string) => void;
  stopMining: () => void;
}

const MiningContext = createContext<MiningContextValue>({
  isMining: false,
  startMining: () => {},
  stopMining: () => {},
});

export function useMining() {
  return useContext(MiningContext);
}

export function MiningProvider({
  children,
  initialStatus,
}: {
  children: React.ReactNode;
  initialStatus: MiningStatus;
}) {
  const [isMining, setIsMining] = useState(initialStatus.isMining);
  const mineIdRef = useRef(initialStatus.mineId);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const doMineAction = useCallback(async () => {
    if (!mineIdRef.current) return;
    try {
      await fetch("/api/game/mine-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mine_id: mineIdRef.current }),
      });
    } catch {
      // Network error — skip this tick
    }
  }, []);

  useEffect(() => {
    if (!isMining) {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }

    // Fire immediately on start, then every 3 seconds
    doMineAction();
    tickRef.current = setInterval(doMineAction, 3000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [isMining, doMineAction]);

  const startMining = useCallback((mineId: string) => {
    mineIdRef.current = mineId;
    setIsMining(true);
  }, []);

  const stopMining = useCallback(() => {
    setIsMining(false);
    mineIdRef.current = null;
  }, []);

  return (
    <MiningContext.Provider value={{ isMining, startMining, stopMining }}>
      {children}
    </MiningContext.Provider>
  );
}
