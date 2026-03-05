"use client";

import { ChevronDown, ChevronRight, FileCode } from "lucide-react";
import { useState } from "react";

interface FileSummaryCardProps {
  filePath: string;
}

export function FileSummaryCard({ filePath }: FileSummaryCardProps) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="border-b border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        <FileCode className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-600 dark:text-slate-400">文件摘要</span>
        <span className="text-slate-400">— 功能开发中</span>
      </button>
      {!collapsed && (
        <div className="px-4 pb-3 text-xs text-slate-400">
          <p>Decision 9c: AI 驱动的文件摘要卡片将在 Phase 3 实现。</p>
          <p className="mt-1 text-[10px]">文件: {filePath}</p>
        </div>
      )}
    </div>
  );
}
