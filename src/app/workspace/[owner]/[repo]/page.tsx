"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { FileTree } from "@/components/workspace/FileTree";
import { CodeViewer } from "@/components/workspace/CodeViewer";
import { DependencyGraph } from "@/components/workspace/DependencyGraph";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { HotPathProgressBar } from "@/components/file-tree/HotPathProgressBar";
import { NavigationBar } from "@/components/workspace/NavigationBar";
import { SymbolOutline } from "@/components/workspace/SymbolOutline";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useHotPathStore } from "@/stores/hotpath-store";
import { useNavigationStore } from "@/stores/navigation-store";
import { useProgressStore } from "@/stores/progress-store";
import {
  Loader2,
  Network,
  FileCode,
} from "lucide-react";

export default function WorkspacePage() {
  return <WorkspaceContent />;
}

function WorkspaceContent() {
  const {
    owner,
    repo,
    repoData,
    tree,
    loading,
    error,
    activeFile,
    activeFileContent,
    centerView,
    pendingNavigation,
    setRepoData,
    setTree,
    setLoading,
    setError,
    navigateToFile,
    setActiveFileContent,
    clearPendingNavigation,
    setCenterView,
    setHotPathHighlights,
  } = useWorkspaceStore();

  const { setHotPath } = useHotPathStore();
  const pushNavigation = useNavigationStore((s) => s.pushNavigation);
  const markModuleExplored = useProgressStore((s) => s.markModuleExplored);
  const setProgressTotals = useProgressStore((s) => s.setTotals);
  const hotPathTriggered = useRef(false);
  const [retryCount, setRetryCount] = useState(0);

  // Sync file content when activeFile changes
  useEffect(() => {
    if (!activeFile) {
      setActiveFileContent(null);
      return;
    }
    let cancelled = false;
    async function fetchContent() {
      try {
        const params = new URLSearchParams({ owner, repo, path: activeFile! });
        const res = await fetch(`/api/github/file?${params}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled && data.content) {
          setActiveFileContent(data.content);
        }
      } catch { /* ignore */ }
    }
    fetchContent();
    return () => { cancelled = true; };
  }, [owner, repo, activeFile, setActiveFileContent]);

  // When navigating from AI, auto-switch to code view
  useEffect(() => {
    if (pendingNavigation?.source === "ai") {
      setCenterView("code");
    }
    if (pendingNavigation) {
      clearPendingNavigation();
    }
  }, [pendingNavigation, setCenterView, clearPendingNavigation]);

  // File tree click handler
  const handleFileSelect = useCallback(
    (path: string) => {
      navigateToFile(path, undefined, "tree");
      setCenterView("code");
      pushNavigation({ file: path, line: 1 });
      // Track module exploration
      const modName = path.includes("/") ? path.split("/")[0] : null;
      if (modName) markModuleExplored(modName);
    },
    [navigateToFile, setCenterView, pushNavigation, markModuleExplored]
  );

  // Navigation from dependency graph
  const handleGraphNavigate = useCallback(
    (path: string) => {
      navigateToFile(path, undefined, "code");
      setCenterView("code");
      pushNavigation({ file: path, line: 1 });
      const modName = path.includes("/") ? path.split("/")[0] : null;
      if (modName) markModuleExplored(modName);
    },
    [navigateToFile, setCenterView, pushNavigation, markModuleExplored]
  );

  // Initialize: fetch repo data + tree
  useEffect(() => {
    if (!owner || !repo) return;

    async function init() {
      try {
        const [repoRes, treeRes] = await Promise.all([
          fetch(`/api/github/repo?owner=${owner}&repo=${repo}`),
          fetch(`/api/github/tree?owner=${owner}&repo=${repo}`),
        ]);

        if (!repoRes.ok) {
          const err = await repoRes.json();
          throw new Error(err.error || "仓库加载失败");
        }

        const repoJson = await repoRes.json();
        setRepoData(repoJson);

        if (treeRes.ok) {
          const treeJson = await treeRes.json();
          const treeItems = treeJson.tree || [];
          setTree(treeItems);
          // Count unique top-level directories as modules
          const modules = new Set(
            treeItems
              .filter((t: { path: string }) => t.path.includes("/"))
              .map((t: { path: string }) => t.path.split("/")[0])
          );
          setProgressTotals(treeItems.length, modules.size);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [owner, repo, setRepoData, setTree, setError, setLoading, setProgressTotals, retryCount]);

  // Decision 6: Hot Path First
  useEffect(() => {
    if (loading || error || hotPathTriggered.current || !owner || !repo) return;
    hotPathTriggered.current = true;

    async function triggerHotPath() {
      try {
        const res = await fetch(`/api/github/hotpath?owner=${owner}&repo=${repo}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.files && data.files.length > 0) {
          const hotFiles = data.files.map((f: { path: string; score: number; rank?: number; inDegree: number; outDegree: number; reason: string }) => ({
            path: f.path,
            score: f.score,
            rank: f.rank ?? 0,
            inDegree: f.inDegree,
            outDegree: f.outDegree,
            reason: f.reason,
            cognitivePrereqs: [],
          }));
          setHotPath(hotFiles, data.entryPoint || hotFiles[0]?.path, data.structureSummary || null);
          setHotPathHighlights(hotFiles.map((f: { path: string }) => f.path));

          if (data.entryPoint) {
            navigateToFile(data.entryPoint, undefined, "ai");
          }
        }
      } catch {
        // Hot path is best-effort
      }
    }

    triggerHotPath();
  }, [loading, error, owner, repo, setHotPath, setHotPathHighlights, navigateToFile]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-sm text-slate-500">加载 {owner}/{repo} ...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const isRateLimit = error.includes("频率超限") || error.includes("rate limit");
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="mx-auto max-w-md rounded-lg border border-red-200 bg-red-50 p-8 text-center dark:border-red-900 dark:bg-red-950/20">
          <p className="mb-2 text-lg font-semibold text-red-700 dark:text-red-400">
            {isRateLimit ? "GitHub API 请求频率超限" : "加载失败"}
          </p>
          <p className="mb-4 text-sm text-red-600/80 dark:text-red-400/70">{error}</p>
          {isRateLimit && (
            <p className="mb-4 text-xs text-slate-500">
              配置 <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">GITHUB_TOKEN</code> 环境变量可将限额从 60 次/小时提升至 5000 次/小时。
            </p>
          )}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => { setError(null); setLoading(true); hotPathTriggered.current = false; setRetryCount((c: number) => c + 1); }}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              重试
            </button>
            <Link href="/" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
              返回首页
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const fullName = repoData ? repoData.fullName : `${owner}/${repo}`;

  return (
    <WorkspaceShell
      sidebar={
        <div className="flex h-full flex-col">
          <HotPathProgressBar />
          <div className="px-3 py-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              文件浏览器
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto px-2">
            <FileTree
              tree={tree}
              selectedPath={activeFile || undefined}
              onFileSelect={handleFileSelect}
            />
          </div>
        </div>
      }
      center={
        <div className="flex h-full flex-col overflow-hidden">
          {/* View toggle bar */}
          <div className="flex h-9 shrink-0 items-center gap-1 border-b border-slate-200 px-2 dark:border-slate-800">
            <button
              onClick={() => setCenterView("code")}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                centerView === "code"
                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              }`}
            >
              <FileCode className="h-3.5 w-3.5" />
              代码
            </button>
            <button
              onClick={() => setCenterView("graph")}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                centerView === "graph"
                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              }`}
            >
              <Network className="h-3.5 w-3.5" />
              拓扑图
            </button>
            {activeFile && (
              <span className="ml-2 truncate text-xs font-mono text-slate-400">
                {activeFile}
              </span>
            )}
          </div>

          {/* Navigation bar (Decision 9a) */}
          {centerView === "code" && <NavigationBar />}

          {/* Content area */}
          <div className="flex flex-1 overflow-hidden">
            {/* Symbol outline (Decision 9a) */}
            {centerView === "code" && (
              <SymbolOutline owner={owner} repo={repo} filePath={activeFile} />
            )}
            <div className="flex-1 overflow-hidden">
              {centerView === "code" ? (
                <CodeViewer
                  owner={owner}
                  repo={repo}
                  filePath={activeFile}
                />
              ) : (
                <DependencyGraph
                  owner={owner}
                  repo={repo}
                  filePath={activeFile}
                  onFileNavigate={handleGraphNavigate}
                />
              )}
            </div>
          </div>
        </div>
      }
      chat={
        <ErrorBoundary>
          <ChatInterface
            projectName={fullName}
            projectUrl={`https://github.com/${owner}/${repo}`}
            projectDescription={repoData?.description || undefined}
            currentFile={activeFile || undefined}
            currentFileContent={activeFileContent || undefined}
            onFileNavigate={(path: string) => navigateToFile(path, undefined, "ai")}
          />
        </ErrorBoundary>
      }
    />
  );
}
