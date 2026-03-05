"use client";

import { useState } from "react";
import { useChallengeStore } from "@/stores/challenge-store";
import { Pickaxe, Eye, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";

/**
 * ArchaeologyChallenge — Phase 6b gamification component.
 * Shows two versions of code side by side, user analyzes
 * what changed and why.
 *
 * :::archaeology
 * {"title":"Router重构","before":"// v1: 硬编码路由\napp.get('/users', handler1);\napp.get('/posts', handler2);","after":"// v2: 中间件模式\nconst routes = loadRoutes();\nroutes.forEach(r => app[r.method](r.path, ...r.middlewares, r.handler));","question":"这次重构的主要目的是什么？","options":["提高性能","提高可维护性","修复安全漏洞","减少代码量"],"answerIndex":1,"explanation":"重构将硬编码路由改为动态加载..."}
 * :::
 */

export interface ArchaeologyChallengeData {
  id: string;
  title: string;
  before: string;
  after: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

interface Props {
  data: ArchaeologyChallengeData;
}

export function ArchaeologyChallenge({ data }: Props) {
  const [view, setView] = useState<"before" | "after" | "diff">("diff");
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const addResult = useChallengeStore((s) => s.addResult);

  const handleSubmit = () => {
    if (selected === null || revealed) return;
    const isCorrect = selected === data.answerIndex;
    setRevealed(true);
    addResult({
      id: data.id,
      type: "archaeology",
      question: data.question,
      userAnswer: data.options[selected],
      correctAnswer: data.options[data.answerIndex],
      isCorrect,
      score: isCorrect ? 10 : 0,
    });
  };

  const isCorrect = selected === data.answerIndex;

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-cyan-200 bg-gradient-to-br from-cyan-50 to-white dark:border-cyan-800 dark:from-cyan-950/30 dark:to-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cyan-100 bg-cyan-50/50 px-4 py-2.5 dark:border-cyan-900 dark:bg-cyan-950/40">
        <div className="flex items-center gap-2">
          <Pickaxe className="h-4 w-4 text-cyan-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
            代码考古
          </span>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {data.title}
          </span>
        </div>
        {/* View toggle */}
        <div className="flex rounded-md border border-cyan-200 dark:border-cyan-700">
          {(["before", "diff", "after"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${
                view === v
                  ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-800 dark:text-cyan-200"
                  : "text-slate-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/30"
              }`}
            >
              {v === "before" ? "旧版" : v === "after" ? "新版" : "对比"}
            </button>
          ))}
        </div>
      </div>

      {/* Code view */}
      <div className="border-b border-cyan-100 dark:border-cyan-900">
        {view === "diff" ? (
          <div className="grid grid-cols-2 divide-x divide-cyan-100 dark:divide-cyan-900">
            <div className="p-3">
              <div className="mb-1.5 flex items-center gap-1.5">
                <ChevronLeft className="h-3 w-3 text-red-400" />
                <span className="text-[10px] font-semibold uppercase text-red-500">旧版</span>
              </div>
              <pre className="overflow-x-auto rounded bg-red-50/50 p-2 text-xs leading-relaxed text-slate-700 dark:bg-red-950/10 dark:text-slate-300">
                {data.before}
              </pre>
            </div>
            <div className="p-3">
              <div className="mb-1.5 flex items-center gap-1.5">
                <ChevronRight className="h-3 w-3 text-green-400" />
                <span className="text-[10px] font-semibold uppercase text-green-500">新版</span>
              </div>
              <pre className="overflow-x-auto rounded bg-green-50/50 p-2 text-xs leading-relaxed text-slate-700 dark:bg-green-950/10 dark:text-slate-300">
                {data.after}
              </pre>
            </div>
          </div>
        ) : (
          <div className="p-3">
            <div className="mb-1.5 flex items-center gap-1.5">
              <Eye className="h-3 w-3 text-cyan-400" />
              <span className="text-[10px] font-semibold uppercase text-cyan-500">
                {view === "before" ? "旧版" : "新版"}
              </span>
            </div>
            <pre className="overflow-x-auto rounded bg-slate-50 p-2 text-xs leading-relaxed text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {view === "before" ? data.before : data.after}
            </pre>
          </div>
        )}
      </div>

      {/* Question + Options */}
      <div className="p-4">
        <p className="mb-3 text-sm font-medium text-slate-800 dark:text-slate-200">
          {data.question}
        </p>

        <div className="mb-4 space-y-2">
          {data.options.map((option, i) => {
            let cls =
              "border-slate-200 hover:border-cyan-300 hover:bg-cyan-50/50 dark:border-slate-700 dark:hover:border-cyan-700";
            if (selected === i && !revealed) {
              cls = "border-cyan-400 bg-cyan-50 ring-1 ring-cyan-400/30 dark:border-cyan-500 dark:bg-cyan-950/40";
            }
            if (revealed) {
              if (i === data.answerIndex) {
                cls = "border-green-400 bg-green-50 dark:border-green-600 dark:bg-green-950/30";
              } else if (selected === i && !isCorrect) {
                cls = "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30";
              } else {
                cls = "border-slate-200 opacity-50 dark:border-slate-700";
              }
            }
            return (
              <button
                key={i}
                onClick={() => !revealed && setSelected(i)}
                disabled={revealed}
                className={`flex w-full items-center gap-3 rounded-lg border px-4 py-2.5 text-left text-sm transition-all ${cls}`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="flex-1 text-slate-700 dark:text-slate-300">{option}</span>
              </button>
            );
          })}
        </div>

        {!revealed ? (
          <button
            onClick={handleSubmit}
            disabled={selected === null}
            className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            提交分析
          </button>
        ) : (
          <div
            className={`rounded-lg border p-3 ${
              isCorrect
                ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20"
                : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
            }`}
          >
            <div className="mb-2 flex items-center gap-2">
              <CheckCircle2 className={`h-4 w-4 ${isCorrect ? "text-green-600" : "text-red-600"}`} />
              <span className={`text-sm font-semibold ${isCorrect ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                {isCorrect ? "分析正确！+10分" : "答案不正确"}
              </span>
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
