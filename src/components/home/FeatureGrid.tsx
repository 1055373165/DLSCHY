"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Eye, BookOpen, Gamepad2, Zap } from "lucide-react";

const FEATURES = [
  {
    icon: Eye,
    title: "让不可见的变得可见",
    description:
      "Mermaid 状态图、序列图、流程图自动生成，把运行时行为变成一眼看懂的视觉画面",
  },
  {
    icon: BookOpen,
    title: "拟人化叙事",
    description:
      "组件变身角色，用第一人称旅程讲述数据在系统中的经历，技术细节变成引人入胜的故事",
  },
  {
    icon: Gamepad2,
    title: "互动挑战",
    description:
      "预测挑战、反事实推理、代码考古、角色扮演——从被动阅读变为主动思考",
  },
  {
    icon: Zap,
    title: "深度穿透",
    description:
      "五层深度阶梯，从语言语义到 OS 边界，完整调用链无模糊跳跃，状态机无遗漏状态",
  },
];

export function FeatureGrid() {
  return (
    <section className="pb-16">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature) => (
          <Card
            key={feature.title}
            className="border-slate-200 transition-shadow hover:shadow-md dark:border-slate-800"
          >
            <CardContent className="pt-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                <feature.icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="mb-1.5 font-semibold text-slate-900 dark:text-white">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {feature.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
