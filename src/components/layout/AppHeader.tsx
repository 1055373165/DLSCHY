"use client";

import Link from "next/link";
import { Code2, Settings } from "lucide-react";

interface AppHeaderProps {
  showSettings?: boolean;
}

export function AppHeader({ showSettings = true }: AppHeaderProps) {
  return (
    <header className="border-b border-slate-200 dark:border-slate-800">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <Code2 className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            Happy SourceCode
          </span>
        </Link>
        {showSettings && (
          <Link
            href="/settings"
            className="rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <Settings className="h-5 w-5" />
          </Link>
        )}
      </div>
    </header>
  );
}
