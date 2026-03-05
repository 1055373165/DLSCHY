"use client";

import Link from "next/link";
import { Code2, PanelLeftClose, PanelLeft, Star, GitBranch, Globe, Sun, Moon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LearningProgressBar } from "@/components/workspace/LearningProgressBar";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useGraphStore } from "@/stores/graph-store";
import { useTheme } from "next-themes";

export function WorkspaceTopBar() {
  const { owner, repo, repoData, sidebarOpen, toggleSidebar } = useWorkspaceStore();
  const { toggleNorthStar } = useGraphStore();
  const { theme, setTheme } = useTheme();

  return (
    <div className="shrink-0">
      <div className="flex h-12 items-center justify-between border-b border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
        {/* Left: logo + sidebar toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSidebar}
            className="hidden rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 md:block dark:hover:bg-slate-800 dark:hover:text-slate-300"
            title={sidebarOpen ? "收起侧栏" : "展开侧栏"}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeft className="h-4 w-4" />
            )}
          </button>

          <Link href="/" className="flex items-center gap-1.5">
            <Code2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
              HSC
            </span>
          </Link>

          <span className="text-slate-300 dark:text-slate-600">/</span>

          <div className="flex items-center gap-2 overflow-hidden">
            <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-300">
              {owner}/{repo}
            </span>
            {repoData?.language && (
              <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">
                {repoData.language}
              </Badge>
            )}
            {repoData?.stars != null && repoData.stars > 0 && (
              <span className="hidden items-center gap-0.5 text-[10px] text-slate-400 sm:flex">
                <Star className="h-3 w-3" />
                {repoData.stars.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Right: North Star button + links */}
        <div className="flex items-center gap-1">
          {/* North Star Button — Decision 10 */}
          <button
            onClick={toggleNorthStar}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
            title="北极星图 (Cmd+Shift+G)"
          >
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">北极星</span>
          </button>

          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            title={theme === "dark" ? "切换亮色主题" : "切换暗色主题"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {repoData && (
            <a
              href={`https://github.com/${owner}/${repo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              title="在 GitHub 上查看"
            >
              <GitBranch className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      {/* Learning progress bar */}
      <LearningProgressBar />
    </div>
  );
}
