"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigationStore } from "@/stores/navigation-store";

export function NavigationBreadcrumb() {
  const { canGoBack, canGoForward, navigationStack, stackCursor } = useNavigationStore();

  if (navigationStack.length === 0) return null;

  const current = navigationStack[stackCursor];

  return (
    <div className="flex items-center gap-1 border-b border-slate-200 px-3 py-1 dark:border-slate-800">
      <button
        disabled={!canGoBack()}
        onClick={() => {
          // TODO: wire up in Phase 3
        }}
        className="rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
        title="后退 (Alt+←)"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <button
        disabled={!canGoForward()}
        onClick={() => {
          // TODO: wire up in Phase 3
        }}
        className="rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
        title="前进 (Alt+→)"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
      {current && (
        <span className="ml-1 truncate text-[10px] text-slate-400">
          {current.file}
          {current.symbol && <span className="text-slate-500"> → {current.symbol}</span>}
        </span>
      )}
    </div>
  );
}
