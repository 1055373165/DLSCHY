"use client";

import { useState } from "react";
import { useChallengeStore } from "@/stores/challenge-store";
import { FlaskConical, ChevronRight, CheckCircle2, Lightbulb } from "lucide-react";

/**
 * CounterfactualChallenge — Phase 6b gamification component.
 * "What if they hadn't designed it this way?" interactive card.
 *
 * AI outputs:
 * :::counterfactual
 * {"scenario":"如果Router不使用中间件模式，而是硬编码所有路由...","currentDesign":"中间件模式","alternatives":[{"name":"硬编码路由","consequence":"每次新增路由都需要修改核心代码..."},{"name":"配置文件路由","consequence":"灵活性提高但缺少类型安全..."}],"insight":"中间件模式在灵活性和类型安全之间取得了平衡..."}
 * :::
 */

export interface CounterfactualAlternative {
  name: string;
  consequence: string;
}

export interface CounterfactualChallengeData {
  id: string;
  scenario: string;
  currentDesign: string;
  alternatives: CounterfactualAlternative[];
  insight: string;
}

interface Props {
  data: CounterfactualChallengeData;
}

export function CounterfactualChallenge({ data }: Props) {
  const [selectedAlt, setSelectedAlt] = useState<number | null>(null);
  const [showInsight, setShowInsight] = useState(false);
  const addResult = useChallengeStore((s) => s.addResult);
  const [recorded, setRecorded] = useState(false);

  const handleRevealInsight = () => {
    setShowInsight(true);
    if (!recorded) {
      setRecorded(true);
      addResult({
        id: data.id,
        type: "counterfactual",
        question: data.scenario,
        userAnswer: selectedAlt !== null ? data.alternatives[selectedAlt].name : "skipped",
        correctAnswer: data.currentDesign,
        isCorrect: true,
        score: 5,
      });
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 to-white dark:border-fuchsia-800 dark:from-fuchsia-950/30 dark:to-slate-900">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-fuchsia-100 bg-fuchsia-50/50 px-4 py-2.5 dark:border-fuchsia-900 dark:bg-fuchsia-950/40">
        <FlaskConical className="h-4 w-4 text-fuchsia-500" />
        <span className="text-xs font-semibold uppercase tracking-wider text-fuchsia-600 dark:text-fuchsia-400">
          反事实推理
        </span>
      </div>

      <div className="p-4">
        {/* Scenario */}
        <p className="mb-3 text-sm font-medium text-slate-800 dark:text-slate-200">
          {data.scenario}
        </p>

        {/* Current design badge */}
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs text-slate-500">实际采用：</span>
          <span className="rounded-full bg-fuchsia-100 px-2.5 py-0.5 text-xs font-medium text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300">
            {data.currentDesign}
          </span>
        </div>

        {/* Alternative choices */}
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          如果改用其他方案？
        </p>
        <div className="mb-4 space-y-2">
          {data.alternatives.map((alt, i) => (
            <button
              key={i}
              onClick={() => setSelectedAlt(i)}
              className={`w-full rounded-lg border p-3 text-left transition-all ${
                selectedAlt === i
                  ? "border-fuchsia-400 bg-fuchsia-50 ring-1 ring-fuchsia-400/30 dark:border-fuchsia-500 dark:bg-fuchsia-950/40"
                  : "border-slate-200 hover:border-fuchsia-300 hover:bg-fuchsia-50/50 dark:border-slate-700 dark:hover:border-fuchsia-700"
              }`}
            >
              <div className="flex items-center gap-2">
                <ChevronRight className={`h-3.5 w-3.5 transition-transform ${selectedAlt === i ? "rotate-90 text-fuchsia-500" : "text-slate-400"}`} />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {alt.name}
                </span>
              </div>
              {selectedAlt === i && (
                <p className="mt-2 pl-5.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {alt.consequence}
                </p>
              )}
            </button>
          ))}
        </div>

        {/* Reveal insight button */}
        {!showInsight ? (
          <button
            onClick={handleRevealInsight}
            className="flex items-center gap-1.5 rounded-md bg-fuchsia-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-fuchsia-700"
          >
            <Lightbulb className="h-3.5 w-3.5" />
            揭示设计洞察
          </button>
        ) : (
          <div className="rounded-lg border border-fuchsia-200 bg-fuchsia-50 p-3 dark:border-fuchsia-800 dark:bg-fuchsia-950/20">
            <div className="mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-fuchsia-600 dark:text-fuchsia-400" />
              <span className="text-sm font-semibold text-fuchsia-700 dark:text-fuchsia-400">
                设计洞察 +5分
              </span>
            </div>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              {data.insight}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
