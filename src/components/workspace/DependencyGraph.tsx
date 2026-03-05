"use client";

import { useState, useEffect, useCallback } from "react";
import { MermaidRenderer } from "@/components/chat/MermaidRenderer";
import { useGraphStore } from "@/stores/graph-store";
import {
  Network,
  Boxes,
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  ArrowDownUp,
  MoveRight,
  MoveDown,
  MoveLeft,
  MoveUp,
  MousePointerClick,
} from "lucide-react";

type Direction = "LR" | "TB" | "RL" | "BT";

interface GraphData {
  focusFile: string;
  stats: {
    totalNodes: number;
    totalEdges: number;
    callChains: number;
    modules: number;
  };
  mermaid: {
    l1: string;
    l2: string;
    l3: string;
  };
  graph: {
    nodes: Array<{
      id: string;
      label: string;
      filePath: string;
      role: string;
      module: string;
      weight: number;
    }>;
    edges: Array<{
      source: string;
      target: string;
      kind: string;
      symbols: string[];
    }>;
    callChains: Array<{
      source: string;
      target: string;
      kind: string;
      symbols: string[];
    }>;
    modules: Array<{
      id: string;
      label: string;
      dirPath: string;
      fileCount: number;
    }>;
  };
}

interface DependencyGraphProps {
  owner: string;
  repo: string;
  filePath: string | null;
  onFileNavigate?: (path: string) => void;
}

const DIRECTION_CONFIG: Record<Direction, { label: string; icon: typeof MoveRight }> = {
  LR: { label: "左→右", icon: MoveRight },
  TB: { label: "上→下", icon: MoveDown },
  RL: { label: "右→左", icon: MoveLeft },
  BT: { label: "下→上", icon: MoveUp },
};

function applyDirection(mermaid: string, direction: Direction): string {
  return mermaid.replace(/^graph\s+(LR|TB|RL|BT)/, `graph ${direction}`);
}

export function DependencyGraph({
  owner,
  repo,
  filePath,
  onFileNavigate,
}: DependencyGraphProps) {
  const [direction, setDirection] = useState<Direction>("LR");
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDirectionMenu, setShowDirectionMenu] = useState(false);

  // Decision 11: Topology drill-down state from graph-store
  const topoLevel = useGraphStore((s) => s.topoLevel);
  const topoFocusModule = useGraphStore((s) => s.topoFocusModule);
  const topoBreadcrumb = useGraphStore((s) => s.topoBreadcrumb);
  const drillIntoModule = useGraphStore((s) => s.drillIntoModule);
  const drillOut = useGraphStore((s) => s.drillOut);
  const resetTopo = useGraphStore((s) => s.resetTopo);

  const fetchGraph = useCallback(async () => {
    if (!filePath) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        owner,
        repo,
        path: filePath,
        depth: "2",
      });

      const res = await fetch(`/api/github/dependencies?${params}`);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch dependencies");
      }

      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [owner, repo, filePath]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // Reset topo when file changes
  useEffect(() => {
    resetTopo();
  }, [filePath, resetTopo]);

  if (!filePath) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        <div className="text-center">
          <Network className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm">选择一个文件查看依赖拓扑图</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin" />
          <p className="text-sm">正在分析文件依赖关系...</p>
          <p className="mt-1 text-xs opacity-60">{filePath}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-400" />
          <p className="mb-2 text-sm text-red-500">{error}</p>
          <button
            onClick={fetchGraph}
            className="rounded-md bg-slate-100 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
          >
            <RefreshCw className="mr-1 inline h-3 w-3" />
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Decision 11: Show L3 overview or L1 drill-in based on topoLevel
  const currentLayer = topoLevel === "L3" ? "l3" : "l1";
  const currentMermaid = applyDirection(data.mermaid[currentLayer], direction);

  // Filter L1 nodes to show only files in the focused module
  const filteredNodes = topoFocusModule
    ? data.graph.nodes.filter((n) => n.module === topoFocusModule)
    : data.graph.nodes;

  return (
    <div className="flex h-full flex-col">
      {/* Header: Breadcrumb + controls */}
      <div className="shrink-0 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 px-3 py-2">
          {/* Breadcrumb (Decision 11) */}
          <div className="flex items-center gap-0.5">
            {topoBreadcrumb.map((crumb, i) => {
              const isLast = i === topoBreadcrumb.length - 1;
              return (
                <span key={`${crumb}-${i}`} className="flex items-center gap-0.5">
                  {i > 0 && <ChevronRight className="h-3 w-3 text-slate-300 dark:text-slate-600" />}
                  <button
                    onClick={() => {
                      if (crumb === "概览") resetTopo();
                      else if (!isLast) drillOut();
                    }}
                    disabled={isLast}
                    className={`rounded px-1.5 py-0.5 text-xs transition-colors ${
                      isLast
                        ? "font-medium text-slate-800 dark:text-white"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                    }`}
                  >
                    {crumb === "概览" ? (
                      <span className="flex items-center gap-1">
                        <Boxes className="h-3 w-3" />
                        模块概览
                      </span>
                    ) : (
                      crumb
                    )}
                  </button>
                </span>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-1">
            {/* Level indicator */}
            <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${
              topoLevel === "L3"
                ? "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                : "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
            }`}>
              {topoLevel === "L3" ? "L3 模块级" : "L1 文件级"}
            </span>

            <span className="mx-0.5 h-4 w-px bg-slate-200 dark:bg-slate-700" />

            {/* Direction selector */}
            <div className="relative">
              <button
                onClick={() => setShowDirectionMenu(!showDirectionMenu)}
                className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                title="切换布局方向"
              >
                <ArrowDownUp className="h-3.5 w-3.5" />
                <span className="text-[10px]">{DIRECTION_CONFIG[direction].label}</span>
              </button>
              {showDirectionMenu && (
                <div className="absolute right-0 top-full z-20 mt-1 w-28 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  {(Object.entries(DIRECTION_CONFIG) as [Direction, typeof DIRECTION_CONFIG.LR][]).map(
                    ([dir, cfg]) => {
                      const DIcon = cfg.icon;
                      const isActive = direction === dir;
                      return (
                        <button
                          key={dir}
                          onClick={() => {
                            setDirection(dir);
                            setShowDirectionMenu(false);
                          }}
                          className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                            isActive
                              ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400"
                              : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                          }`}
                        >
                          <DIcon className="h-3 w-3" />
                          {cfg.label}
                        </button>
                      );
                    }
                  )}
                </div>
              )}
            </div>

            <span className="mx-0.5 h-4 w-px bg-slate-200 dark:bg-slate-700" />

            <button
              onClick={fetchGraph}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              title="刷新"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-4 px-4 py-1.5 text-[10px] text-slate-400">
          <span>
            <strong className="text-slate-600 dark:text-slate-300">{data.stats.totalNodes}</strong> 节点
          </span>
          <span>
            <strong className="text-slate-600 dark:text-slate-300">{data.stats.totalEdges}</strong> 依赖边
          </span>
          <span>
            <strong className="text-slate-600 dark:text-slate-300">{data.stats.modules}</strong> 模块
          </span>
          {topoLevel === "L1" && topoFocusModule && (
            <span className="text-blue-500">
              聚焦: <strong>{topoFocusModule}</strong> ({filteredNodes.length} 文件)
            </span>
          )}
        </div>
      </div>

      {/* Graph content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-full">
          <MermaidRenderer chart={currentMermaid} />
        </div>

        {/* L3 Module list — clickable to drill into L1 */}
        {topoLevel === "L3" && data.graph.modules.length > 0 && (
          <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-700">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <Boxes className="h-3.5 w-3.5" />
                模块列表 · 点击钻入查看文件级依赖
              </h4>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {data.graph.modules.map((mod) => (
                <button
                  key={mod.id}
                  onClick={() => drillIntoModule(mod.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <Boxes className="h-3.5 w-3.5 text-purple-500" />
                  <span className="flex-1 truncate font-mono text-slate-700 dark:text-slate-300">{mod.label}</span>
                  <span className="shrink-0 text-[10px] text-slate-400">
                    {mod.fileCount} 文件
                  </span>
                  <MousePointerClick className="h-3 w-3 text-slate-300 dark:text-slate-600" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* L1 File list — clickable to navigate to code */}
        {topoLevel === "L1" && filteredNodes.length > 0 && (
          <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-700">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <Network className="h-3.5 w-3.5" />
                文件列表 · 点击跳转到源码
              </h4>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {filteredNodes.map((node) => (
                <button
                  key={node.id}
                  onClick={() => onFileNavigate?.(node.filePath)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                    node.filePath === filePath
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      node.role === "focus"
                        ? "bg-indigo-500"
                        : node.role === "direct"
                        ? "bg-blue-400"
                        : node.role === "external"
                        ? "bg-amber-400"
                        : "bg-slate-300"
                    }`}
                  />
                  <span className="flex-1 truncate font-mono">{node.filePath}</span>
                  {node.weight > 0 && (
                    <span className="shrink-0 text-[10px] text-slate-400">
                      ×{node.weight}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
