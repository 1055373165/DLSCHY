"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitBranch, ArrowRight, Star } from "lucide-react";

const EXAMPLE_PROJECTS = [
  {
    name: "go-chi/chi",
    description: "轻量级 Go HTTP 路由器",
    language: "Go",
    stars: "18k",
    difficulty: "入门",
    url: "https://github.com/go-chi/chi",
  },
  {
    name: "redis/redis",
    description: "高性能内存数据库",
    language: "C",
    stars: "67k",
    difficulty: "进阶",
    url: "https://github.com/redis/redis",
  },
  {
    name: "gin-gonic/gin",
    description: "Go 最流行的 Web 框架",
    language: "Go",
    stars: "79k",
    difficulty: "入门",
    url: "https://github.com/gin-gonic/gin",
  },
  {
    name: "kubernetes/kubernetes",
    description: "容器编排系统",
    language: "Go",
    stars: "112k",
    difficulty: "专家",
    url: "https://github.com/kubernetes/kubernetes",
  },
];

function DifficultyBadge({ level }: { level: string }) {
  const colorMap: Record<string, string> = {
    入门: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    进阶: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    专家: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorMap[level] || ""}`}>
      {level}
    </span>
  );
}

export function ProjectCarousel() {
  const router = useRouter();

  const handleClick = (projectUrl: string) => {
    router.push(`/project/new?url=${encodeURIComponent(projectUrl)}`);
  };

  return (
    <section className="pb-20">
      <div className="mb-6 text-center">
        <h2 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">热门项目推荐</h2>
        <p className="text-slate-600 dark:text-slate-400">从这些精选项目开始你的源码学习之旅</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {EXAMPLE_PROJECTS.map((project) => (
          <Card
            key={project.name}
            className="group cursor-pointer border-slate-200 transition-all hover:border-indigo-300 hover:shadow-md dark:border-slate-800 dark:hover:border-indigo-700"
            onClick={() => handleClick(project.url)}
          >
            <CardContent className="pt-5 pb-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{project.name}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-500 dark:text-slate-600" />
              </div>
              <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">{project.description}</p>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-xs">{project.language}</Badge>
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Star className="h-3 w-3" />
                  {project.stars}
                </span>
                <DifficultyBadge level={project.difficulty} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
