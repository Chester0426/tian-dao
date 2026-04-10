"use client";

import { useEffect } from "react";

let audio: HTMLAudioElement | null = null;

function playClick() {
  if (!audio) {
    audio = new Audio("/sounds/click.wav");
    audio.volume = 0.3;
  }
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

export function useClickSfx() {
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (
        target.closest("button") ||
        target.closest("a") ||
        target.closest("[role='button']")
      ) {
        playClick();
      }
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);
}
