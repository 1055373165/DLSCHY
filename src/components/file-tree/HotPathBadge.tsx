"use client";

interface HotPathBadgeProps {
  rank: number;
  isCompleted?: boolean;
}

export function HotPathBadge({ rank, isCompleted }: HotPathBadgeProps) {
  return (
    <span
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
        isCompleted
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
          : "animate-pulse bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400"
      }`}
    >
      {rank}
    </span>
  );
}
