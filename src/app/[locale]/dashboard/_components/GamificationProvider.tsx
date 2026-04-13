"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

interface CriticalHitEvent {
  taskId: string;
  bonusPoints: number;
}

interface MysterySpinEvent {
  outcomeIndex: number;
  points: number;
  label: string;
  icon: string;
  color: string;
}

interface StreakMilestoneEvent {
  milestone: number;
}

interface GamificationState {
  criticalHit: CriticalHitEvent | null;
  mysterySpin: MysterySpinEvent | null;
  perfectDay: { bonusPoints: number } | null;
  streakMilestone: StreakMilestoneEvent | null;
  confettiActive: boolean;
}

interface GamificationContextValue extends GamificationState {
  triggerCriticalHit: (event: CriticalHitEvent) => void;
  triggerMysterySpin: (event: MysterySpinEvent) => void;
  triggerPerfectDay: (bonusPoints: number) => void;
  triggerStreakMilestone: (event: StreakMilestoneEvent) => void;
  clearCelebration: (type: keyof GamificationState) => void;
}

const GamificationContext = createContext<GamificationContextValue | null>(null);

const INITIAL_STATE: GamificationState = {
  criticalHit: null,
  mysterySpin: null,
  perfectDay: null,
  streakMilestone: null,
  confettiActive: false,
};

export function GamificationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GamificationState>(INITIAL_STATE);

  const triggerCriticalHit = useCallback((event: CriticalHitEvent) => {
    setState((prev) => ({ ...prev, criticalHit: event }));
    setTimeout(() => {
      setState((prev) => ({ ...prev, criticalHit: null }));
    }, 2000);
  }, []);

  const triggerMysterySpin = useCallback((event: MysterySpinEvent) => {
    setState((prev) => ({ ...prev, mysterySpin: event }));
    // stays until manually dismissed
  }, []);

  const triggerPerfectDay = useCallback((bonusPoints: number) => {
    setState((prev) => ({
      ...prev,
      perfectDay: { bonusPoints },
      confettiActive: true,
    }));
    setTimeout(() => {
      setState((prev) => ({ ...prev, confettiActive: false }));
    }, 4000);
    // perfectDay itself stays until manually dismissed
  }, []);

  const triggerStreakMilestone = useCallback((event: StreakMilestoneEvent) => {
    setState((prev) => ({ ...prev, streakMilestone: event }));
    // stays until manually dismissed
  }, []);

  const clearCelebration = useCallback((type: keyof GamificationState) => {
    setState((prev) => ({
      ...prev,
      [type]: type === "confettiActive" ? false : null,
    }));
  }, []);

  const value: GamificationContextValue = {
    ...state,
    triggerCriticalHit,
    triggerMysterySpin,
    triggerPerfectDay,
    triggerStreakMilestone,
    clearCelebration,
  };

  return (
    <GamificationContext.Provider value={value}>
      {children}
    </GamificationContext.Provider>
  );
}

export function useGamification(): GamificationContextValue {
  const ctx = useContext(GamificationContext);
  if (!ctx) {
    throw new Error("useGamification must be used within a GamificationProvider");
  }
  return ctx;
}
