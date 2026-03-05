"use client";

import { useEffect, useCallback } from "react";
import { X, Globe, Loader2, Flame, Boxes, LayoutGrid } from "lucide-react";
import { useGraphStore } from "@/stores/graph-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { ForceGraph } from "./ForceGraph";

export function NorthStarOverlay() {
  const {
    northStarOpen,
    closeNorthStar,
    graphData,
    graphLoading,
    graphFilter,
    northStarCenter,
    setGraphFilter,
    setGraphData,
    setGraphLoading,
  } = useGraphStore();
  const owner = useWorkspaceStore((s) => s.owner);
  const repo = useWorkspaceStore((s) => s.repo);
  const navigateToFile = useWorkspaceStore((s) => s.navigateToFile);
  const setCenterView = useWorkspaceStore((s) => s.setCenterView);

  // Fetch graph data when overlay opens
  useEffect(() => {
    if (!northStarOpen || graphData || !owner || !repo) return;

    let cancelled = false;
    setGraphLoading(true);

    fetch(`/api/github/graph?owner=${owner}&repo=${repo}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.nodes) {
          setGraphData(data);
        }
      })
      .catch(() => {
        // ignore
      })
      .finally(() => {
        if (!cancelled) setGraphLoading(false);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [northStarOpen, graphData, owner, repo]);

  // Close on Escape
  useEffect(() => {
    if (!northStarOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeNorthStar();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [northStarOpen, closeNorthStar]);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      navigateToFile(nodeId, undefined, "graph");
      setCenterView("code");
      closeNorthStar();
    },
    [navigateToFile, setCenterView, closeNorthStar]
  );

  const handleNodeDoubleClick = useCallback(
    (nodeId: string) => {
      navigateToFile(nodeId, undefined, "graph");
      setCenterView("code");
      closeNorthStar();
    },
    [navigateToFile, setCenterView, closeNorthStar]
  );

  if (!northStarOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative flex h-[75vh] w-[90vw] max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              北极星 — 全局关系图谱
            </h2>
            {/* Filter buttons */}
            <div className="ml-4 flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
              <FilterButton
                active={graphFilter === "all"}
                onClick={() => setGraphFilter("all")}
                icon={<LayoutGrid className="h-3.5 w-3.5" />}
                label="全部"
              />
              <FilterButton
                active={graphFilter === "hotpath"}
                onClick={() => setGraphFilter("hotpath")}
                icon={<Flame className="h-3.5 w-3.5" />}
                label="热路径"
              />
              <FilterButton
                active={graphFilter === "module"}
                onClick={() => setGraphFilter("module")}
                icon={<Boxes className="h-3.5 w-3.5" />}
                label="模块"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              Cmd+Shift+G 打开 · Esc 关闭 · 拖拽节点 · 滚轮缩放
            </span>
            <button
              onClick={closeNorthStar}
              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              title="关闭 (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {graphLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-indigo-500" />
                <p className="text-sm text-slate-500">正在构建全局关系图谱...</p>
                <p className="mt-1 text-xs text-slate-400">分析依赖关系和热路径中</p>
              </div>
            </div>
          ) : graphData ? (
            <ForceGraph
              graph={graphData}
              centerFile={northStarCenter}
              filter={graphFilter}
              onNodeClick={handleNodeClick}
              onNodeDoubleClick={handleNodeDoubleClick}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Globe className="mx-auto mb-4 h-16 w-16 text-slate-200 dark:text-slate-700" />
                <p className="text-sm text-slate-400">无法加载图谱数据</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer stats */}
        {graphData && (
          <div className="border-t border-slate-200 px-6 py-2 dark:border-slate-800">
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span>{graphData.nodes.length} 节点</span>
              <span>{graphData.edges.length} 连接</span>
              <span>{graphData.clusters.length} 模块</span>
              <span>{graphData.nodes.filter((n) => n.isHotPath).length} 热路径文件</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
          : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
