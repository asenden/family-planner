"use client";

import { useEffect, useState, useCallback } from "react";

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

interface IdleScreensaverProps {
  photos?: string[];
}

export function IdleScreensaver({ photos = [] }: IdleScreensaverProps) {
  const [isIdle, setIsIdle] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const resetTimer = useCallback(() => { setIsIdle(false); }, []);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    function scheduleIdle() {
      clearTimeout(timeout);
      timeout = setTimeout(() => setIsIdle(true), IDLE_TIMEOUT_MS);
    }
    const events = ["mousedown", "mousemove", "touchstart", "keydown", "scroll"];
    function handleActivity() { resetTimer(); scheduleIdle(); }
    events.forEach((event) => window.addEventListener(event, handleActivity));
    scheduleIdle();
    return () => {
      clearTimeout(timeout);
      events.forEach((event) => window.removeEventListener(event, handleActivity));
    };
  }, [resetTimer]);

  useEffect(() => {
    if (!isIdle || photos.length === 0) return;
    const interval = setInterval(() => {
      setCurrentPhotoIndex((i) => (i + 1) % photos.length);
    }, 10_000);
    return () => clearInterval(interval);
  }, [isIdle, photos.length]);

  if (!isIdle) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black cursor-pointer" onClick={resetTimer} onTouchStart={resetTimer}>
      {photos.length > 0 ? (
        <img src={photos[currentPhotoIndex]} alt="" className="max-h-full max-w-full object-contain transition-opacity duration-1000" />
      ) : (
        <div className="text-center">
          <div className="text-6xl mb-4">🖼</div>
          <p className="text-white/50 text-xl">FamilyDisplay</p>
        </div>
      )}
    </div>
  );
}
