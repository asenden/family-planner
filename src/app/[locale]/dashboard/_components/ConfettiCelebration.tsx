"use client";

import { useMemo } from "react";
import { useGamification } from "./GamificationProvider";

const CONFETTI_COLORS = [
  "#a78bfa",
  "#67e8f9",
  "#fbbf24",
  "#f43f5e",
  "#34d399",
  "#fb923c",
  "#60a5fa",
  "#e879f9",
];

const PARTICLE_COUNT = 40;

// Simple seeded pseudo-random (mulberry32)
function makeRng(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ConfettiCelebration() {
  const { confettiActive } = useGamification();

  const particles = useMemo(() => {
    const rng = makeRng(0xfacc15);
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const color = CONFETTI_COLORS[Math.floor(rng() * CONFETTI_COLORS.length)];
      const isCircle = rng() > 0.5;
      const size = 6 + Math.floor(rng() * 10); // 6–15px
      const left = rng() * 100; // 0–100vw
      const delay = rng() * 2.5; // 0–2.5s
      const duration = 2.5 + rng() * 2; // 2.5–4.5s
      const rotateEnd = -360 + Math.floor(rng() * 720); // -360 to +360
      const drift = -60 + rng() * 120; // horizontal drift in px

      return { i, color, isCircle, size, left, delay, duration, rotateEnd, drift };
    });
  }, []);

  if (!confettiActive) return null;

  return (
    <>
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-20px) translateX(0) rotate(0deg);
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) translateX(var(--drift)) rotate(var(--rotate-end));
            opacity: 0;
          }
        }
        .confetti-particle {
          animation: confetti-fall var(--duration) ease-in var(--delay) forwards;
        }
      `}</style>

      <div
        className="fixed inset-0 z-[9980] pointer-events-none overflow-hidden"
        aria-hidden="true"
      >
        {particles.map((p) => (
          <div
            key={p.i}
            className="confetti-particle absolute top-0"
            style={{
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: p.color,
              borderRadius: p.isCircle ? "50%" : "2px",
              "--duration": `${p.duration}s`,
              "--delay": `${p.delay}s`,
              "--drift": `${p.drift}px`,
              "--rotate-end": `${p.rotateEnd}deg`,
            } as React.CSSProperties}
          />
        ))}
      </div>
    </>
  );
}
