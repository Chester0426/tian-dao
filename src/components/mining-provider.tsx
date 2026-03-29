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
  pauseBackground: () => void;
  resumeBackground: () => void;
}

const MiningContext = createContext<MiningContextValue>({
  isMining: false,
  startMining: () => {},
  stopMining: () => {},
  pauseBackground: () => {},
  resumeBackground: () => {},
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
  const pausedRef = useRef(false);

  const doMineAction = useCallback(async () => {
    if (!mineIdRef.current || pausedRef.current) return;
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

    // Only fire background actions when not paused (mining page handles its own)
    if (!pausedRef.current) {
      doMineAction();
    }
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

  // Mining page calls this to prevent double API calls
  const pauseBackground = useCallback(() => {
    pausedRef.current = true;
  }, []);

  const resumeBackground = useCallback(() => {
    pausedRef.current = false;
  }, []);

  return (
    <MiningContext.Provider value={{ isMining, startMining, stopMining, pauseBackground, resumeBackground }}>
      {children}
    </MiningContext.Provider>
  );
}
