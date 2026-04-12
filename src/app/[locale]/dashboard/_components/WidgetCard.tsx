"use client";

import type { ReactNode } from "react";

interface WidgetCardProps {
  title: string;
  icon: string;
  color: string;
  children: ReactNode;
  onTap?: () => void;
  delay?: number;
}

export function WidgetCard({ title, icon, color, children, onTap, delay = 0 }: WidgetCardProps) {
  return (
    <button
      onClick={onTap}
      className="glass glass-hover w-full text-left p-5 cursor-pointer animate-slide-up"
      style={{
        borderRadius: "var(--border-radius)",
        animationDelay: `${delay}ms`,
      }}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <span className="text-xl">{icon}</span>
        <span
          className="text-[11px] font-bold uppercase tracking-[0.15em]"
          style={{ color }}
        >
          {title}
        </span>
      </div>
      <div className="text-sm" style={{ color: "var(--color-text)" }}>
        {children}
      </div>
    </button>
  );
}
