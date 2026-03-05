"use client";

import { useChallengeStore } from "@/stores/challenge-store";
import { Trophy, Target, Flame, BarChart3 } from "lucide-react";

/**
 * ChallengeScoreboard — displays gamification stats inline in the chat panel.
 * Shows total score, accuracy, and current streak.
 */

export function ChallengeScoreboard() {
  const results = useChallengeStore((s) => s.results);
  const totalScore = useChallengeStore((s) => s.totalScore);
  const streak = useChallengeStore((s) => s.streak);

  const total = results.length;
  if (total === 0) return null;

  const correct = results.filter((r) => r.isCorrect).length;
  const accuracy = Math.round((correct / total) * 100);

  return (
    <div className="mx-3 mb-3 rounded-lg border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-3 dark:border-amber-800 dark:from-amber-950/20 dark:to-orange-950/20">
      <div className="mb-2 flex items-center gap-1.5">
        <Trophy className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
          挑战记录
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <StatItem
          icon={<BarChart3 className="h-3 w-3" />}
          label="总分"
          value={String(totalScore)}
        />
        <StatItem
          icon={<Target className="h-3 w-3" />}
          label="正确率"
          value={`${accuracy}%`}
        />
        <StatItem
          icon={<Flame className="h-3 w-3" />}
          label="连续"
          value={String(streak)}
        />
        <StatItem
          icon={<Trophy className="h-3 w-3" />}
          label="已完成"
          value={`${correct}/${total}`}
        />
      </div>
    </div>
  );
}

function StatItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="text-center">
      <div className="mb-0.5 flex items-center justify-center text-amber-500 dark:text-amber-400">
        {icon}
      </div>
      <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
        {value}
      </div>
      <div className="text-[9px] text-slate-500">{label}</div>
    </div>
  );
}
