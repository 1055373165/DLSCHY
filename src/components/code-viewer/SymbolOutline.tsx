"use client";

import { List } from "lucide-react";

export function SymbolOutline() {
  return (
    <div className="flex h-full flex-col border-r border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50">
      <div className="flex items-center gap-1.5 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <List className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
          符号大纲
        </span>
      </div>
      <div className="flex flex-1 items-center justify-center p-4 text-center">
        <p className="text-xs text-slate-400">
          Decision 9a: 符号大纲功能将在 Phase 3 实现
        </p>
      </div>
    </div>
  );
}
