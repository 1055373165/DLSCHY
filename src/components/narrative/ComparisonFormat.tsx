"use client";

import { Scale, ThumbsUp, ThumbsDown } from "lucide-react";

/**
 * ComparisonFormat — Phase 6c narrative renderer.
 * Side-by-side scheme comparison with pros/cons.
 */

export interface ComparisonScheme {
  name: string;
  pros: string[];
  cons: string[];
}

export interface ComparisonFormatData {
  title: string;
  schemes: ComparisonScheme[];
}

interface Props {
  data: ComparisonFormatData;
}

export function ComparisonFormat({ data }: Props) {
  return (
    <div className="my-3 overflow-hidden rounded-lg border border-orange-200 dark:border-orange-800">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-orange-100 bg-orange-50/50 px-4 py-2.5 dark:border-orange-900 dark:bg-orange-950/40">
        <Scale className="h-4 w-4 text-orange-500" />
        <span className="text-xs font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">
          方案对比
        </span>
        <span className="ml-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          {data.title}
        </span>
      </div>

      {/* Comparison grid */}
      <div
        className="grid divide-x divide-orange-100 dark:divide-orange-900"
        style={{ gridTemplateColumns: `repeat(${Math.min(data.schemes.length, 3)}, minmax(0, 1fr))` }}
      >
        {data.schemes.map((scheme, i) => (
          <div key={i} className="p-4">
            <h4 className="mb-3 text-center text-sm font-semibold text-slate-800 dark:text-slate-200">
              {scheme.name}
            </h4>

            {/* Pros */}
            {scheme.pros.length > 0 && (
              <div className="mb-3">
                <div className="mb-1.5 flex items-center gap-1">
                  <ThumbsUp className="h-3 w-3 text-green-500" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">
                    优势
                  </span>
                </div>
                <ul className="space-y-1">
                  {scheme.pros.map((pro, j) => (
                    <li key={j} className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      <span className="mr-1 text-green-500">+</span>
                      {pro}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Cons */}
            {scheme.cons.length > 0 && (
              <div>
                <div className="mb-1.5 flex items-center gap-1">
                  <ThumbsDown className="h-3 w-3 text-red-500" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
                    劣势
                  </span>
                </div>
                <ul className="space-y-1">
                  {scheme.cons.map((con, j) => (
                    <li key={j} className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      <span className="mr-1 text-red-500">−</span>
                      {con}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
