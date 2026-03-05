"use client";

import { Globe } from "lucide-react";
import { useGraphStore } from "@/stores/graph-store";

export function NorthStarButton() {
  const { toggleNorthStar } = useGraphStore();

  return (
    <button
      onClick={toggleNorthStar}
      className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
      title="北极星图 (Cmd+Shift+G)"
    >
      <Globe className="h-4 w-4" />
      <span className="hidden sm:inline">北极星</span>
    </button>
  );
}
