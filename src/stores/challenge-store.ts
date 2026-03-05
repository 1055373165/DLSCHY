/**
 * Challenge tracking store — tracks completed challenges, scores, and streaks.
 * Part of Phase 6b: Gamification Challenge System.
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { enableMapSet } from "immer";

enableMapSet();

export type ChallengeType =
  | "prediction"
  | "counterfactual"
  | "archaeology"
  | "redesign"
  | "roleplay";

export interface ChallengeResult {
  id: string;
  type: ChallengeType;
  question: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  score: number;
  completedAt: number;
}

interface ChallengeState {
  results: ChallengeResult[];
  totalScore: number;
  streak: number;
  bestStreak: number;
}

interface ChallengeActions {
  addResult: (result: Omit<ChallengeResult, "completedAt">) => void;
  getStats: () => {
    total: number;
    correct: number;
    accuracy: number;
    totalScore: number;
    streak: number;
    bestStreak: number;
    byType: Record<ChallengeType, { total: number; correct: number }>;
  };
  reset: () => void;
}

const initialState: ChallengeState = {
  results: [],
  totalScore: 0,
  streak: 0,
  bestStreak: 0,
};

export const useChallengeStore = create<ChallengeState & ChallengeActions>()(
  immer((set, get) => ({
    ...initialState,

    addResult: (result) =>
      set((state) => {
        const full: ChallengeResult = {
          ...result,
          completedAt: Date.now(),
        };
        state.results.push(full);
        state.totalScore += result.score;

        if (result.isCorrect) {
          state.streak += 1;
          if (state.streak > state.bestStreak) {
            state.bestStreak = state.streak;
          }
        } else {
          state.streak = 0;
        }
      }),

    getStats: () => {
      const { results, totalScore, streak, bestStreak } = get();
      const correct = results.filter((r) => r.isCorrect).length;
      const total = results.length;

      const byType = {} as Record<
        ChallengeType,
        { total: number; correct: number }
      >;
      const types: ChallengeType[] = [
        "prediction",
        "counterfactual",
        "archaeology",
        "redesign",
        "roleplay",
      ];
      for (const t of types) {
        const ofType = results.filter((r) => r.type === t);
        byType[t] = {
          total: ofType.length,
          correct: ofType.filter((r) => r.isCorrect).length,
        };
      }

      return {
        total,
        correct,
        accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
        totalScore,
        streak,
        bestStreak,
        byType,
      };
    },

    reset: () => set(initialState),
  }))
);
