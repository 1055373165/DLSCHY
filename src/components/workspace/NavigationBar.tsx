"use client";

import { ChevronLeft, ChevronRight, List, Clock } from "lucide-react";
import { useNavigationStore } from "@/stores/navigation-store";
import { useWorkspaceStore } from "@/stores/workspace-store";

/**
 * Decision 9a: Navigation history bar with back/forward buttons
 * and breadcrumb display of the jump stack.
 * Alt+← / Alt+→ keyboard shortcuts are handled in use-keyboard-nav.ts
 */
export function NavigationBar() {
  const canGoBack = useNavigationStore((s) => s.canGoBack());
  const canGoForward = useNavigationStore((s) => s.canGoForward());
  const goBack = useNavigationStore((s) => s.goBack);
  const goForward = useNavigationStore((s) => s.goForward);
  const stack = useNavigationStore((s) => s.navigationStack);
  const cursor = useNavigationStore((s) => s.stackCursor);
  const toggleOutline = useNavigationStore((s) => s.toggleOutline);
  const outlineVisible = useNavigationStore((s) => s.outlineVisible);

  const navigateToFile = useWorkspaceStore((s) => s.navigateToFile);

  const handleBack = () => {
    const entry = goBack();
    if (entry) navigateToFile(entry.file, entry.line, "code");
  };

  const handleForward = () => {
    const entry = goForward();
    if (entry) navigateToFile(entry.file, entry.line, "code");
  };

  // Show last few breadcrumb entries
  const breadcrumbs = stack.slice(Math.max(0, cursor - 3), cursor + 1);
  const startIdx = Math.max(0, cursor - 3);

  return (
    <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50/80 px-2 py-1 dark:border-slate-800 dark:bg-slate-900/80">
      {/* Back/Forward buttons */}
      <button
        onClick={handleBack}
        disabled={!canGoBack}
        className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-slate-700"
        title="后退 (Alt+←)"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={handleForward}
        disabled={!canGoForward}
        className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-slate-700"
        title="前进 (Alt+→)"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>

      {/* Breadcrumb trail */}
      <div className="flex flex-1 items-center gap-0.5 overflow-hidden">
        {breadcrumbs.length > 0 ? (
          breadcrumbs.map((entry, i) => {
            const globalIdx = startIdx + i;
            const isCurrent = globalIdx === cursor;
            const fileName = entry.file.split("/").pop() || entry.file;
            return (
              <span key={`${entry.file}-${entry.line}-${globalIdx}`} className="flex items-center gap-0.5">
                {i > 0 && <span className="text-[10px] text-slate-300 dark:text-slate-600">›</span>}
                <button
                  onClick={() => {
                    navigateToFile(entry.file, entry.line, "code");
                  }}
                  className={`max-w-[120px] truncate rounded px-1.5 py-0.5 text-[11px] transition-colors ${
                    isCurrent
                      ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                      : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                  title={`${entry.file}:${entry.line}`}
                >
                  {fileName}
                  {entry.line > 0 && <span className="text-slate-400">:{entry.line}</span>}
                </button>
              </span>
            );
          })
        ) : (
          <span className="text-[11px] text-slate-400">
            <Clock className="mr-1 inline h-3 w-3" />
            跳转历史为空
          </span>
        )}
      </div>

      {/* Outline toggle */}
      <button
        onClick={toggleOutline}
        className={`rounded p-1 transition-colors ${
          outlineVisible
            ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
            : "text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
        }`}
        title="符号大纲"
      >
        <List className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
