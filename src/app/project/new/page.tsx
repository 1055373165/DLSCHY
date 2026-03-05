"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Code2,
  Loader2,
  GitBranch,
  Star,
  FileCode,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Flame,
  Network,
} from "lucide-react";
import Link from "next/link";

interface RepoInfo {
  name: string;
  owner: string;
  fullName: string;
  description: string;
  language: string;
  stars: number;
  size: number;
  defaultBranch: string;
}

interface AnalysisResults {
  treeCount: number;
  hotPathFiles: string[];
  entryPoint: string | null;
  structureSummary: string | null;
}

type AnalysisStep = {
  id: string;
  label: string;
  detail?: string;
  status: "pending" | "running" | "done" | "error";
};

function NewProjectContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const url = searchParams.get("url") || "";
  const initiated = useRef(false);

  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<AnalysisStep[]>([
    { id: "fetch", label: "获取仓库信息", status: "running" },
    { id: "tree", label: "加载文件树", status: "pending" },
    { id: "hotpath", label: "热路径分析", status: "pending" },
    { id: "ready", label: "准备就绪", status: "pending" },
  ]);

  const updateStep = (id: string, status: AnalysisStep["status"], detail?: string) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status, detail: detail ?? s.detail } : s))
    );
  };

  useEffect(() => {
    if (!url || initiated.current) return;
    initiated.current = true;

    const match = url.match(/github\.com\/([^/]+)\/([^/\s?#]+)/);
    if (!match) {
      setError("无效的 GitHub 仓库地址");
      setLoading(false);
      return;
    }

    const [, owner, repo] = match;
    const repoName = repo.replace(/\.git$/, "");

    const runAnalysis = async () => {
      try {
        // Step 1: Fetch repo metadata via our API
        const repoRes = await fetch(`/api/github/repo?owner=${owner}&repo=${repoName}`);
        if (!repoRes.ok) {
          const errData = await repoRes.json().catch(() => ({}));
          throw new Error(errData.error || `仓库加载失败 (${repoRes.status})`);
        }
        const repoData = await repoRes.json();

        const info: RepoInfo = {
          name: repoData.name || repoName,
          owner: repoData.owner || owner,
          fullName: repoData.fullName || `${owner}/${repoName}`,
          description: repoData.description || "暂无描述",
          language: repoData.language || "Unknown",
          stars: repoData.stars ?? 0,
          size: repoData.size ?? 0,
          defaultBranch: repoData.defaultBranch || "main",
        };
        setRepoInfo(info);
        updateStep("fetch", "done");

        // Step 2: Fetch file tree
        updateStep("tree", "running");
        const treeRes = await fetch(`/api/github/tree?owner=${owner}&repo=${repoName}`);
        if (!treeRes.ok) {
          updateStep("tree", "error", "文件树加载失败");
          throw new Error("文件树加载失败");
        }
        const treeData = await treeRes.json();
        const treeCount = treeData.tree?.length ?? 0;
        updateStep("tree", "done", `${treeCount} 个文件`);

        // Step 3: Hot path analysis
        updateStep("hotpath", "running");
        let hotPathFiles: string[] = [];
        let entryPoint: string | null = null;
        let structureSummary: string | null = null;
        try {
          const hotRes = await fetch(`/api/github/hotpath?owner=${owner}&repo=${repoName}`);
          if (hotRes.ok) {
            const hotData = await hotRes.json();
            hotPathFiles = (hotData.files || []).map((f: { path: string }) => f.path);
            entryPoint = hotData.entryPoint || null;
            structureSummary = hotData.structureSummary || null;
          }
        } catch {
          // Hot path is best-effort
        }
        updateStep("hotpath", "done", `${hotPathFiles.length} 个关键文件`);

        // All done
        setAnalysisResults({ treeCount, hotPathFiles, entryPoint, structureSummary });
        updateStep("ready", "done", "分析完成");
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "未知错误");
        setLoading(false);
      }
    };

    runAnalysis();
  }, [url]);

  const handleStartLearning = () => {
    if (repoInfo) {
      router.push(`/workspace/${repoInfo.owner}/${repoInfo.name}`);
    } else {
      // Fallback to chat page
      const params = new URLSearchParams({ url });
      router.push(`/project/chat?${params.toString()}`);
    }
  };

  const StepIcon = ({ status }: { status: AnalysisStep["status"] }) => {
    switch (status) {
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />;
      case "done":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return (
          <div className="h-4 w-4 rounded-full border-2 border-slate-300 dark:border-slate-600" />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-6">
          <Link href="/" className="flex items-center gap-2">
            <Code2 className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Happy SourceCode
            </span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 pt-16">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">
            项目初始化
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            正在分析仓库结构，为你准备最佳学习路径
          </p>
        </div>

        {/* Repo Info Card */}
        {repoInfo && (
          <Card className="mb-6 border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <GitBranch className="h-5 w-5 text-slate-400" />
                  {repoInfo.owner}/{repoInfo.name}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{repoInfo.language}</Badge>
                  <span className="flex items-center gap-1 text-sm text-slate-500">
                    <Star className="h-3.5 w-3.5" />
                    {repoInfo.stars.toLocaleString()}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
                {repoInfo.description}
              </p>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <FileCode className="h-3.5 w-3.5" />
                  {(repoInfo.size / 1024).toFixed(1)} MB
                </span>
                <span className="flex items-center gap-1">
                  <GitBranch className="h-3.5 w-3.5" />
                  {repoInfo.defaultBranch}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Analysis Steps */}
        <Card className="mb-6 border-slate-200 dark:border-slate-800">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {steps.map((step) => (
                <div key={step.id} className="flex items-center gap-3">
                  <StepIcon status={step.status} />
                  <span
                    className={`text-sm ${
                      step.status === "done"
                        ? "text-slate-900 dark:text-white"
                        : step.status === "running"
                          ? "font-medium text-indigo-600 dark:text-indigo-400"
                          : step.status === "error"
                            ? "text-red-600 dark:text-red-400"
                            : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {step.label}
                  </span>
                  {step.status === "running" && (
                    <span className="text-xs text-slate-400">分析中...</span>
                  )}
                  {step.status === "done" && step.detail && (
                    <span className="text-xs text-slate-400">{step.detail}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Analysis Results Summary */}
        {analysisResults && !loading && !error && (
          <Card className="mb-6 border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
            <CardContent className="pt-6">
              <h3 className="mb-3 text-sm font-semibold text-green-800 dark:text-green-300">
                分析摘要
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 rounded-lg bg-white/60 px-3 py-2 dark:bg-slate-900/40">
                  <Network className="h-4 w-4 text-blue-500" />
                  <div>
                    <div className="text-lg font-bold text-slate-900 dark:text-white">
                      {analysisResults.treeCount}
                    </div>
                    <div className="text-[10px] text-slate-500">文件总数</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-white/60 px-3 py-2 dark:bg-slate-900/40">
                  <Flame className="h-4 w-4 text-orange-500" />
                  <div>
                    <div className="text-lg font-bold text-slate-900 dark:text-white">
                      {analysisResults.hotPathFiles.length}
                    </div>
                    <div className="text-[10px] text-slate-500">关键文件</div>
                  </div>
                </div>
              </div>
              {analysisResults.entryPoint && (
                <div className="mt-3 rounded-lg bg-white/60 px-3 py-2 dark:bg-slate-900/40">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                    推荐入口
                  </div>
                  <div className="mt-0.5 truncate font-mono text-xs text-indigo-600 dark:text-indigo-400">
                    {analysisResults.entryPoint}
                  </div>
                </div>
              )}
              {analysisResults.structureSummary && (
                <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {analysisResults.structureSummary}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
            <CardContent className="flex items-center gap-3 pt-6">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Start Learning Button */}
        {!loading && !error && (
          <div className="text-center">
            <Button
              size="lg"
              onClick={handleStartLearning}
              className="gap-2 bg-indigo-600 px-8 hover:bg-indigo-700"
            >
              开始探索源码
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

export default function NewProjectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        </div>
      }
    >
      <NewProjectContent />
    </Suspense>
  );
}
