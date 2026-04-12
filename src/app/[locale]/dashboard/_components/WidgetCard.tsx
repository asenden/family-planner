"use client";

import type { ReactNode } from "react";

interface WidgetCardProps {
  title: string;
  icon: string;
  color: string;
  children: ReactNode;
  onTap?: () => void;
}

export function WidgetCard({ title, icon, color, children, onTap }: WidgetCardProps) {
  return (
    <button onClick={onTap} className="w-full text-left p-4 transition-transform active:scale-[0.98] cursor-pointer" style={{ backgroundColor: "var(--color-surface)", borderRadius: "var(--border-radius)" }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{icon}</span>
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color }}>{title}</span>
      </div>
      <div className="text-sm" style={{ color: "var(--color-text)" }}>{children}</div>
    </button>
  );
}
