"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, CheckCircle2, XCircle, ChevronDown, ChevronUp } from "lucide-react";

interface PredictionChallengeProps {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty?: "easy" | "medium" | "hard";
}

export function PredictionChallenge({
  question,
  options,
  correctIndex,
  explanation,
  difficulty = "medium",
}: PredictionChallengeProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const answered = selected !== null;
  const isCorrect = selected === correctIndex;

  const difficultyMap = {
    easy: { label: "入门", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    medium: { label: "进阶", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    hard: { label: "专家", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  };

  return (
    <Card className="my-4 border-indigo-200 bg-indigo-50/30 dark:border-indigo-800 dark:bg-indigo-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <CardTitle className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
              预测挑战
            </CardTitle>
          </div>
          <Badge className={difficultyMap[difficulty].color}>
            {difficultyMap[difficulty].label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm font-medium text-slate-800 dark:text-slate-200">
          {question}
        </p>

        <div className="space-y-2">
          {options.map((option, i) => {
            let style = "border-slate-200 bg-white hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-indigo-600";

            if (answered) {
              if (i === correctIndex) {
                style = "border-green-400 bg-green-50 dark:border-green-600 dark:bg-green-950/30";
              } else if (i === selected && !isCorrect) {
                style = "border-red-400 bg-red-50 dark:border-red-600 dark:bg-red-950/30";
              } else {
                style = "border-slate-200 bg-slate-50 opacity-50 dark:border-slate-700 dark:bg-slate-900";
              }
            }

            return (
              <button
                key={i}
                disabled={answered}
                onClick={() => setSelected(i)}
                className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${style}`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="flex-1">{option}</span>
                {answered && i === correctIndex && (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                )}
                {answered && i === selected && !isCorrect && (
                  <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                )}
              </button>
            );
          })}
        </div>

        {answered && (
          <div className="mt-4">
            <div className={`mb-2 rounded-lg px-3 py-2 text-sm font-medium ${
              isCorrect
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
            }`}>
              {isCorrect ? "正确！" : "再想想～"}
            </div>

            <button
              onClick={() => setShowExplanation(!showExplanation)}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
            >
              {showExplanation ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showExplanation ? "收起解析" : "查看解析"}
            </button>

            {showExplanation && (
              <div className="mt-2 rounded-lg bg-white p-3 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                {explanation}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
