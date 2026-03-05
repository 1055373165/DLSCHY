"use client";

import { useState } from "react";
import { BookOpen, Code2 } from "lucide-react";

/**
 * JourneyNarrative — Phase 6a narrative renderer.
 * Displays first-person narrative from a component's perspective,
 * with a side-by-side technical translation toggle.
 */

export interface JourneyNarrativeData {
  narrator: string;
  narrative: string;
  technical: string;
}

interface Props {
  data: JourneyNarrativeData;
}

export function JourneyNarrative({ data }: Props) {
  const [showTechnical, setShowTechnical] = useState(false);

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-violet-200 dark:border-violet-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-violet-100 bg-violet-50/50 px-4 py-2.5 dark:border-violet-900 dark:bg-violet-950/40">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-violet-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            旅程叙事
          </span>
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            {data.narrator}
          </span>
        </div>
        <button
          onClick={() => setShowTechnical(!showTechnical)}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors ${
            showTechnical
              ? "bg-violet-200 text-violet-800 dark:bg-violet-800 dark:text-violet-200"
              : "text-violet-500 hover:bg-violet-100 dark:hover:bg-violet-900/30"
          }`}
        >
          <Code2 className="h-3 w-3" />
          {showTechnical ? "隐藏技术翻译" : "显示技术翻译"}
        </button>
      </div>

      {/* Content */}
      <div className={`${showTechnical ? "grid grid-cols-2 divide-x divide-violet-100 dark:divide-violet-900" : ""}`}>
        {/* Narrative (first-person) */}
        <div className="p-4">
          <div className="prose prose-sm prose-violet dark:prose-invert max-w-none">
            <p className="text-sm italic leading-relaxed text-slate-700 dark:text-slate-300">
              &ldquo;{data.narrative}&rdquo;
            </p>
          </div>
        </div>

        {/* Technical translation */}
        {showTechnical && (
          <div className="bg-slate-50 p-4 dark:bg-slate-900/50">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              技术翻译
            </p>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {data.technical}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
