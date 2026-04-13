import { CRITICAL_HIT_CHANCE, CRITICAL_HIT_MULTIPLIER, MYSTERY_SPIN_OUTCOMES, PERFECT_DAY_BONUS } from "./gamification-constants";

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dateSeed(date: string, memberId: string, salt: string = ""): number {
  const str = `${date}:${memberId}:${salt}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function rollCriticalHit(date: string, memberId: string, taskId: string): boolean {
  const rng = mulberry32(dateSeed(date, memberId, `crit:${taskId}`));
  return rng() < CRITICAL_HIT_CHANCE;
}

export function getCriticalMultiplier(): number {
  return CRITICAL_HIT_MULTIPLIER;
}

export function spinMysteryWheel(date: string, memberId: string): { outcomeIndex: number; points: number; label: string; icon: string; color: string } {
  const rng = mulberry32(dateSeed(date, memberId, "spin"));
  const totalWeight = MYSTERY_SPIN_OUTCOMES.reduce((sum, o) => sum + o.weight, 0);
  const roll = rng() * totalWeight;

  let cumulative = 0;
  for (let i = 0; i < MYSTERY_SPIN_OUTCOMES.length; i++) {
    cumulative += MYSTERY_SPIN_OUTCOMES[i].weight;
    if (roll < cumulative) {
      const o = MYSTERY_SPIN_OUTCOMES[i];
      return { outcomeIndex: i, points: o.points, label: o.label, icon: o.icon, color: o.color };
    }
  }

  const last = MYSTERY_SPIN_OUTCOMES[MYSTERY_SPIN_OUTCOMES.length - 1];
  return { outcomeIndex: MYSTERY_SPIN_OUTCOMES.length - 1, points: last.points, label: last.label, icon: last.icon, color: last.color };
}

export function getPerfectDayBonus(): number {
  return PERFECT_DAY_BONUS;
}
