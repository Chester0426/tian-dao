"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Howl } from "howler";

export function BgmPlayer() {
  const pathname = usePathname();
  const howlRef = useRef<Howl | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.3);
  const [showSlider, setShowSlider] = useState(false);
  const userToggled = useRef(false); // user manually clicked the audio button

  // Position by page type
  // - Landing (/): inside navbar area, offset right past the nav items
  // - Auth pages (/login, /signup, /characters): below language toggle
  // - Game pages (everything else): top-right corner
  const isLanding = pathname === "/";
  const isAuthPage = ["/login", "/signup", "/characters"].includes(pathname);
  const position = isLanding
    ? "top-[68px] right-5"
    : isAuthPage
      ? "top-[100px] right-9"
      : "top-4 right-4";

  useEffect(() => {
    howlRef.current = new Howl({
      src: ["/audio/bgm.mp3"],
      loop: true,
      volume: 0.3,
      html5: true,
    });

    // Auto-play on first user click (once), unless user already toggled manually
    const autoPlay = () => {
      if (userToggled.current) return;
      howlRef.current?.play();
      setPlaying(true);
      document.removeEventListener("click", autoPlay);
      document.removeEventListener("touchstart", autoPlay);
    };
    document.addEventListener("click", autoPlay, { once: true });
    document.addEventListener("touchstart", autoPlay, { once: true });

    return () => {
      document.removeEventListener("click", autoPlay);
      document.removeEventListener("touchstart", autoPlay);
      howlRef.current?.unload();
    };
  }, []);

  // Sync volume
  useEffect(() => {
    if (howlRef.current) {
      howlRef.current.volume(volume);
    }
  }, [volume]);

  const togglePlay = useCallback(() => {
    if (!howlRef.current) return;
    userToggled.current = true;
    if (playing) {
      howlRef.current.pause();
      setPlaying(false);
    } else {
      howlRef.current.play();
      setPlaying(true);
    }
  }, [playing]);

  return (
    <div
      className={`fixed ${position} z-40 flex items-center gap-2`}
      onMouseEnter={() => setShowSlider(true)}
      onMouseLeave={() => setShowSlider(false)}
    >
      {showSlider && (
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="w-20 h-1 appearance-none rounded-full cursor-pointer"
          style={{
            background: `linear-gradient(to right, #d4a853 ${volume * 100}%, rgba(255,255,255,0.2) ${volume * 100}%)`,
            accentColor: "#d4a853",
          }}
        />
      )}
      <button
        onClick={togglePlay}
        className="flex h-9 w-9 items-center justify-center rounded-full transition-all"
        style={{
          background: "rgba(30,20,10,0.6)",
          border: "1px solid rgba(212,168,83,0.4)",
          boxShadow: playing ? "0 0 8px rgba(212,168,83,0.3)" : "none",
        }}
        aria-label={playing ? "Mute" : "Play"}
      >
        {playing ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d4a853" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d4a853" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        )}
      </button>
    </div>
  );
}
