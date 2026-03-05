"use client";

import { useState } from "react";
import { useChallengeStore } from "@/stores/challenge-store";
import { HelpCircle, CheckCircle2, XCircle, Lightbulb, Trophy } from "lucide-react";

/**
 * PredictionChallenge — Phase 6b gamification component.
 *
 * AI outputs a structured challenge block that gets parsed and rendered here.
 * Format: show partial context → user selects from options → reveal answer + explanation.
 *
 * Props are parsed from a structured AI output block like:
 * :::prediction
 * question: Why does this module use a channel instead of a mutex?
 * context: (code snippet or description shown to the user)
 * options: ["Performance", "Simplicity", "Concurrency safety", "Historical accident"]
 * answer: 2
 * explanation: Channels provide concurrency safety by design...
 * :::
 */

export interface PredictionChallengeData {
  id: string;
  question: string;
  context?: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  hint?: string;
}

interface Props {
  data: PredictionChallengeData;
}

export function PredictionChallenge({ data }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const addResult = useChallengeStore((s) => s.addResult);
  const streak = useChallengeStore((s) => s.streak);

  const handleSelect = (index: number) => {
    if (revealed) return;
    setSelected(index);
  };

  const handleSubmit = () => {
    if (selected === null || revealed) return;
    const isCorrect = selected === data.answerIndex;
    setRevealed(true);

    addResult({
      id: data.id,
      type: "prediction",
      question: data.question,
      userAnswer: data.options[selected],
      correctAnswer: data.options[data.answerIndex],
      isCorrect,
      score: isCorrect ? (showHint ? 5 : 10) : 0,
    });
  };

  const isCorrect = selected === data.answerIndex;

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white dark:border-indigo-800 dark:from-indigo-950/30 dark:to-slate-900">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-indigo-100 bg-indigo-50/50 px-4 py-2.5 dark:border-indigo-900 dark:bg-indigo-950/40">
        <HelpCircle className="h-4 w-4 text-indigo-500" />
        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
          预测挑战
        </span>
        {streak > 1 && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
            <Trophy className="h-3 w-3" />
            连续 {streak} 题
          </span>
        )}
      </div>

      <div className="p-4">
        {/* Question */}
        <p className="mb-3 text-sm font-medium text-slate-800 dark:text-slate-200">
          {data.question}
        </p>

        {/* Context (code or description) */}
        {data.context && (
          <pre className="mb-4 overflow-x-auto rounded-md bg-slate-100 p-3 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {data.context}
          </pre>
        )}

        {/* Hint toggle */}
        {data.hint && !revealed && (
          <button
            onClick={() => setShowHint(true)}
            className="mb-3 flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
          >
            <Lightbulb className="h-3.5 w-3.5" />
            {showHint ? data.hint : "显示提示（-5分）"}
          </button>
        )}

        {/* Options */}
        <div className="mb-4 space-y-2">
          {data.options.map((option, i) => {
            let optionClass =
              "border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-slate-700 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/20";

            if (selected === i && !revealed) {
              optionClass =
                "border-indigo-400 bg-indigo-50 ring-1 ring-indigo-400/30 dark:border-indigo-500 dark:bg-indigo-950/40";
            }

            if (revealed) {
              if (i === data.answerIndex) {
                optionClass =
                  "border-green-400 bg-green-50 dark:border-green-600 dark:bg-green-950/30";
              } else if (selected === i && !isCorrect) {
                optionClass =
                  "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30";
              } else {
                optionClass =
                  "border-slate-200 opacity-50 dark:border-slate-700";
              }
            }

            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                disabled={revealed}
                className={`flex w-full items-center gap-3 rounded-lg border px-4 py-2.5 text-left text-sm transition-all ${optionClass}`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="flex-1 text-slate-700 dark:text-slate-300">
                  {option}
                </span>
                {revealed && i === data.answerIndex && (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                )}
                {revealed && selected === i && !isCorrect && (
                  <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                )}
              </button>
            );
          })}
        </div>

        {/* Submit button */}
        {!revealed && (
          <button
            onClick={handleSubmit}
            disabled={selected === null}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            提交答案
          </button>
        )}

        {/* Result + Explanation */}
        {revealed && (
          <div
            className={`rounded-lg border p-3 ${
              isCorrect
                ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20"
                : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
            }`}
          >
            <div className="mb-2 flex items-center gap-2">
              {isCorrect ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                    回答正确！+{showHint ? 5 : 10}分
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <span className="text-sm font-semibold text-red-700 dark:text-red-400">
                    答案不正确
                  </span>
                </>
              )}
            </div>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              {data.explanation}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
