"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Drama, ChevronRight, RotateCcw } from "lucide-react";

interface JourneyStep {
  character: string;
  action: string;
  detail: string;
}

interface PersonaJourneyProps {
  title: string;
  description: string;
  steps: JourneyStep[];
}

export function PersonaJourney({
  title,
  description,
  steps,
}: PersonaJourneyProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const isComplete = currentStep >= steps.length;

  const characterColors: Record<string, string> = {
    default: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  };

  const getColor = (character: string) => {
    if (!characterColors[character]) {
      const colors = [
        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
        "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
        "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
        "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
      ];
      characterColors[character] = colors[Object.keys(characterColors).length % colors.length];
    }
    return characterColors[character];
  };

  return (
    <Card className="my-4 border-emerald-200 bg-emerald-50/30 dark:border-emerald-800 dark:bg-emerald-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Drama className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <CardTitle className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            角色扮演旅程
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-1 text-sm font-medium text-slate-800 dark:text-slate-200">
          {title}
        </p>
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
          {description}
        </p>

        {/* Timeline */}
        <div className="space-y-3">
          {steps.map((step, i) => {
            const isActive = i === currentStep;
            const isPast = i < currentStep;
            const isFuture = i > currentStep;

            return (
              <div
                key={i}
                className={`flex items-start gap-3 rounded-lg border p-3 transition-all ${
                  isActive
                    ? "border-emerald-300 bg-white shadow-sm dark:border-emerald-700 dark:bg-slate-900"
                    : isPast
                      ? "border-transparent bg-white/50 dark:bg-slate-900/50"
                      : "border-transparent opacity-40"
                }`}
              >
                {/* Step indicator */}
                <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  isPast || isActive
                    ? "bg-emerald-500 text-white"
                    : "border-2 border-slate-300 text-slate-400 dark:border-slate-600"
                }`}>
                  {i + 1}
                </div>

                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${getColor(step.character)}`}>
                      {step.character}
                    </span>
                    <span className="text-xs text-slate-500">{step.action}</span>
                  </div>
                  {(isPast || isActive) && !isFuture && (
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      {step.detail}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Controls */}
        <div className="mt-4 flex gap-2">
          {!isComplete ? (
            <Button
              size="sm"
              onClick={() => setCurrentStep(currentStep + 1)}
              className="gap-1 bg-emerald-600 hover:bg-emerald-700"
            >
              下一步
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentStep(0)}
              className="gap-1"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              重播
            </Button>
          )}
          <span className="flex items-center text-xs text-slate-400">
            {Math.min(currentStep + 1, steps.length)} / {steps.length}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
