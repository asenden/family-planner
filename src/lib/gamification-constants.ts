export const STREAK_TIERS = [
  { minDays: 0,  multiplier: 1.0, label: "starter",    icon: "🌱", flameFrom: "#94a3b8", flameTo: "#cbd5e1" },
  { minDays: 3,  multiplier: 1.2, label: "warming_up", icon: "🔥", flameFrom: "#fb923c", flameTo: "#f97316" },
  { minDays: 7,  multiplier: 1.5, label: "on_fire",    icon: "🔥", flameFrom: "#f97316", flameTo: "#ef4444" },
  { minDays: 14, multiplier: 1.8, label: "blazing",    icon: "🔥", flameFrom: "#ef4444", flameTo: "#dc2626" },
  { minDays: 30, multiplier: 2.0, label: "legendary",  icon: "⚡", flameFrom: "#eab308", flameTo: "#f59e0b" },
  { minDays: 60, multiplier: 2.5, label: "mythic",     icon: "💎", flameFrom: "#06b6d4", flameTo: "#8b5cf6" },
] as const;

export const STREAK_MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365] as const;
export const STREAK_FREEZE_COST = 50;

export const CRITICAL_HIT_CHANCE = 0.10;
export const CRITICAL_HIT_MULTIPLIER = 2.0;

export const MYSTERY_SPIN_OUTCOMES = [
  { points: 3,  weight: 30, label: "common",    icon: "⭐",  color: "#94a3b8" },
  { points: 5,  weight: 25, label: "uncommon",  icon: "⭐",  color: "#60a5fa" },
  { points: 8,  weight: 20, label: "rare",      icon: "💫",  color: "#a78bfa" },
  { points: 12, weight: 15, label: "epic",      icon: "🌟",  color: "#f59e0b" },
  { points: 20, weight: 8,  label: "legendary", icon: "🌈",  color: "#f43f5e" },
  { points: 50, weight: 2,  label: "mythic",    icon: "💎",  color: "#06b6d4" },
] as const;

export const PERFECT_DAY_BONUS = 10;
