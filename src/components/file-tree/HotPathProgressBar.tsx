"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useHotPathStore } from "@/stores/hotpath-store";
import { useWorkspaceStore } from "@/stores/workspace-store";

export function HotPathProgressBar() {
  const { files, ready, getProgress, isAllComplete, getNextFile } = useHotPathStore();
  const navigateToFile = useWorkspaceStore((s) => s.navigateToFile);
  const setCenterView = useWorkspaceStore((s) => s.setCenterView);

  if (!ready || files.length === 0) return null;

  const { current, total } = getProgress();
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  const allDone = isAllComplete();

  const handleNextStep = () => {
    const next = getNextFile();
    if (next) {
      navigateToFile(next, undefined, "tree");
      setCenterView("code");
    }
  };

  return (
    <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-800">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
          学习路径
        </span>
        <span className="text-[10px] text-slate-500">
          {current}/{total}
        </span>
      </div>
      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            allDone ? "bg-emerald-500" : "bg-orange-500"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {allDone ? (
        <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3 w-3" />
          核心路径已完成
        </div>
      ) : (
        <button
          onClick={handleNextStep}
          className="flex items-center gap-1 text-[11px] font-medium text-orange-600 transition-colors hover:text-orange-700 dark:text-orange-400"
        >
          下一步
          <ArrowRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
