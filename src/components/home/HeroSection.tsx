"use client";

import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";
import { UrlInputForm } from "./UrlInputForm";

export function HeroSection() {
  return (
    <section className="flex flex-col items-center pt-20 pb-16 text-center">
      <Badge variant="secondary" className="mb-6 gap-1.5 px-3 py-1 text-sm">
        <Zap className="h-3.5 w-3.5" />
        AI 驱动的源码深度学习
      </Badge>

      <h1 className="mb-4 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl dark:text-white">
        像资深维护者一样
        <br />
        <span className="text-indigo-600 dark:text-indigo-400">
          理解开源项目
        </span>
      </h1>

      <p className="mb-10 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
        输入 GitHub 仓库地址，AI
        将为你生成交互式学习体验——可视化架构图、拟人化叙事、互动挑战，
        帮你深度理解源码的设计决策与实现细节。
      </p>

      <UrlInputForm />
    </section>
  );
}
