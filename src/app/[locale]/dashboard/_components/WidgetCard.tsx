"use client";

import type { ReactNode } from "react";

interface WidgetCardProps {
  title: string;
  icon: ReactNode;
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
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: `linear-gradient(135deg, ${color}20, ${color}10)`,
            border: `1px solid ${color}30`,
            boxShadow: `0 0 20px ${color}15`,
            color,
          }}
        >
          {icon}
        </div>
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
