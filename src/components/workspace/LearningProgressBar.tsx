"use client";

import { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useHotPathStore } from "@/stores/hotpath-store";
import { useProgressStore } from "@/stores/progress-store";
import {
  BookOpen,
  GraduationCap,
  Clock,
  Eye,
  Flame,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "刚开始";
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
}

export function LearningProgressBar() {
  const exploredFiles = useWorkspaceStore((s) => s.exploredFiles);
  const tree = useWorkspaceStore((s) => s.tree);
  const { files: hotPathFiles, getProgress } = useHotPathStore();
  const viewMode = useProgressStore((s) => s.viewMode);
  const toggleViewMode = useProgressStore((s) => s.toggleViewMode);
  const sessionStartTime = useProgressStore((s) => s.sessionStartTime);

  // Ticking session timer
  const [elapsed, setElapsed] = useState(() => Date.now() - sessionStartTime);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Date.now() - sessionStartTime);
    }, 30000); // Update every 30s
    return () => clearInterval(timer);
  }, [sessionStartTime]);

  // Count total code files (exclude directories)
  const totalCodeFiles = tree.length;
  const exploredCount = exploredFiles.size;
  const fileProgress = totalCodeFiles > 0
    ? Math.min(100, Math.round((exploredCount / totalCodeFiles) * 100))
    : 0;

  const hotPathProgress = getProgress();

  return (
    <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/50 px-3 py-1 dark:border-slate-800/50 dark:bg-slate-900/30">
      {/* File exploration progress */}
      <div className="flex items-center gap-1.5" title={`已浏览 ${exploredCount}/${totalCodeFiles} 个文件`}>
        <Eye className="h-3 w-3 text-slate-400" />
        <div className="flex items-center gap-1">
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${fileProgress}%` }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-slate-400">
            {exploredCount}/{totalCodeFiles}
          </span>
        </div>
      </div>

      {/* Hot path progress */}
      {hotPathFiles.length > 0 && (
        <div className="flex items-center gap-1.5" title={`热路径进度 ${hotPathProgress.current}/${hotPathProgress.total}`}>
          <Flame className="h-3 w-3 text-orange-400" />
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-12 overflow-hidden rounded-full bg-orange-100 dark:bg-orange-900/30">
              <div
                className="h-full rounded-full bg-orange-500 transition-all duration-500"
                style={{ width: `${hotPathProgress.total > 0 ? Math.round((hotPathProgress.current / hotPathProgress.total) * 100) : 0}%` }}
              />
            </div>
            <span className="text-[10px] tabular-nums text-slate-400">
              {hotPathProgress.current}/{hotPathProgress.total}
            </span>
          </div>
        </div>
      )}

      {/* Session timer */}
      <div className="flex items-center gap-1 text-[10px] text-slate-400" title="本次学习时长">
        <Clock className="h-3 w-3" />
        <span>{mounted ? formatDuration(elapsed) : "刚开始"}</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* View mode toggle */}
      <button
        onClick={toggleViewMode}
        className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
          viewMode === "guided"
            ? "bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400"
            : "bg-purple-50 text-purple-600 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400"
        }`}
        title={viewMode === "guided" ? "引导模式：AI 提供详细解释" : "专家模式：精简输出"}
      >
        {viewMode === "guided" ? (
          <>
            <BookOpen className="h-3 w-3" />
            引导
          </>
        ) : (
          <>
            <GraduationCap className="h-3 w-3" />
            专家
          </>
        )}
        {viewMode === "guided" ? (
          <ToggleLeft className="h-3 w-3" />
        ) : (
          <ToggleRight className="h-3 w-3" />
        )}
      </button>
    </div>
  );
}
