"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FlaskConical, Lightbulb } from "lucide-react";

interface CounterfactualChallengeProps {
  scenario: string;
  hint: string;
  referenceAnswer: string;
}

export function CounterfactualChallenge({
  scenario,
  hint,
  referenceAnswer,
}: CounterfactualChallengeProps) {
  const [answer, setAnswer] = useState("");
  const [showReference, setShowReference] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  return (
    <Card className="my-4 border-purple-200 bg-purple-50/30 dark:border-purple-800 dark:bg-purple-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          <CardTitle className="text-sm font-semibold text-purple-700 dark:text-purple-300">
            反事实推理
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-slate-800 dark:text-slate-200">
          {scenario}
        </p>

        <div className="mb-3 flex items-start gap-2 rounded-lg bg-purple-100/50 px-3 py-2 dark:bg-purple-900/20">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-500" />
          <p className="text-xs text-purple-700 dark:text-purple-300">{hint}</p>
        </div>

        <Textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="写下你的分析..."
          rows={3}
          disabled={submitted}
          className="mb-3 text-sm"
        />

        <div className="flex gap-2">
          {!submitted ? (
            <Button
              size="sm"
              onClick={() => setSubmitted(true)}
              disabled={!answer.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              提交思考
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowReference(!showReference)}
            >
              {showReference ? "收起参考" : "查看参考答案"}
            </Button>
          )}
        </div>

        {showReference && (
          <div className="mt-3 rounded-lg bg-white p-3 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <p className="mb-1 text-xs font-medium text-purple-600 dark:text-purple-400">参考分析：</p>
            {referenceAnswer}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
