"use client";

import { Network, ChevronRight } from "lucide-react";
import { useGraphStore } from "@/stores/graph-store";

export function TopologyView() {
  const { topoLevel, topoFocusModule, topoBreadcrumb, drillOut } = useGraphStore();

  return (
    <div className="flex h-full flex-col">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 border-b border-slate-200 px-4 py-2 dark:border-slate-800">
        {topoBreadcrumb.map((crumb, i) => (
          <div key={crumb} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-slate-300" />}
            <button
              onClick={() => {
                if (i < topoBreadcrumb.length - 1) drillOut();
              }}
              className={`text-xs ${
                i === topoBreadcrumb.length - 1
                  ? "font-medium text-slate-700 dark:text-slate-300"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              }`}
            >
              {crumb}
            </button>
          </div>
        ))}
      </div>

      {/* Content placeholder */}
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <Network className="mx-auto mb-4 h-12 w-12 text-slate-200 dark:text-slate-700" />
          <h3 className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-400">
            {topoLevel === "L3" ? "模块概览 (L3)" : `文件依赖 (L1) — ${topoFocusModule}`}
          </h3>
          <p className="text-xs text-slate-400">
            Decision 11: 层级钻入拓扑图将在 Phase 3 实现
          </p>
        </div>
      </div>
    </div>
  );
}
