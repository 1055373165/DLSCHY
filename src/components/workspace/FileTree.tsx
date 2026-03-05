"use client";

import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, Search, X, Check } from "lucide-react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useHotPathStore } from "@/stores/hotpath-store";
import type { FileStatus } from "@/types/workspace";

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  children?: TreeNode[];
}

interface FileTreeProps {
  tree: TreeNode[];
  selectedPath?: string;
  onFileSelect: (path: string) => void;
}

function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  const lower = query.toLowerCase();
  const results: TreeNode[] = [];
  for (const node of nodes) {
    if (node.type === "file") {
      if (node.name.toLowerCase().includes(lower) || node.path.toLowerCase().includes(lower)) {
        results.push(node);
      }
    } else if (node.children) {
      const filteredChildren = filterTree(node.children, query);
      if (filteredChildren.length > 0) {
        results.push({ ...node, children: filteredChildren });
      }
    }
  }
  return results;
}

/**
 * Check if a directory should be auto-expanded because it contains
 * the currently selected file path.
 */
function shouldAutoExpand(node: TreeNode, selectedPath?: string): boolean {
  if (!selectedPath || node.type !== "directory") return false;
  return selectedPath.startsWith(node.path + "/");
}

export function FileTree({ tree, selectedPath, onFileSelect }: FileTreeProps) {
  const [search, setSearch] = useState("");
  const getFileStatus = useWorkspaceStore((s) => s.getFileStatus);
  const getRankForFile = useHotPathStore((s) => s.getRankForFile);
  const hotPathFiles = useHotPathStore((s) => s.files);
  const currentStep = useHotPathStore((s) => s.currentStep);
  const completed = useHotPathStore((s) => s.completed);

  const filteredTree = useMemo(() => {
    if (!search.trim()) return tree;
    return filterTree(tree, search.trim());
  }, [tree, search]);

  return (
    <div className="text-sm">
      {/* Search input */}
      <div className="relative mb-2 px-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索文件..."
          className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-xs outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:placeholder:text-slate-500 dark:focus:border-indigo-700"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {filteredTree.length === 0 && search && (
        <p className="px-3 py-4 text-center text-xs text-slate-400">无匹配文件</p>
      )}

      {filteredTree.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onFileSelect={onFileSelect}
          forceExpand={!!search}
          getFileStatus={getFileStatus}
          getRankForFile={getRankForFile}
          hotPathFiles={hotPathFiles}
          currentStep={currentStep}
          completedFiles={completed}
        />
      ))}
    </div>
  );
}

/** Hot path numbered badge — Decision 8 */
function HotPathBadge({ rank, isCurrentStep, isCompleted }: { rank: number; isCurrentStep: boolean; isCompleted: boolean }) {
  if (isCompleted) {
    return (
      <span className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
        ✓
      </span>
    );
  }
  return (
    <span
      className={`inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white ${
        isCurrentStep ? "h-[22px] w-[22px] animate-pulse ring-2 ring-orange-300" : ""
      }`}
    >
      {rank}
    </span>
  );
}

/** Status indicator dot/icon for file nodes */
function StatusIndicator({ status, rank, isCurrentStep, isCompleted }: {
  status: FileStatus | "explored" | null;
  rank: number | null;
  isCurrentStep: boolean;
  isCompleted: boolean;
}) {
  // Hot-path files get numbered badge instead of flame icon
  if (rank !== null && status === "hot-path") {
    return <HotPathBadge rank={rank} isCurrentStep={isCurrentStep} isCompleted={isCompleted} />;
  }
  if (!status) return null;
  switch (status) {
    case "explored":
      return <Check className="h-3 w-3 shrink-0 text-emerald-500" />;
    case "ai-mentioned":
      return <span className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-blue-500" />;
    case "hot-path":
      return <HotPathBadge rank={0} isCurrentStep={false} isCompleted={false} />;
    default:
      return null;
  }
}

function FileTreeNode({
  node,
  depth,
  selectedPath,
  onFileSelect,
  forceExpand,
  getFileStatus,
  getRankForFile,
  hotPathFiles,
  currentStep,
  completedFiles,
}: {
  node: TreeNode;
  depth: number;
  selectedPath?: string;
  onFileSelect: (path: string) => void;
  forceExpand?: boolean;
  getFileStatus: (path: string) => FileStatus | "explored" | null;
  getRankForFile: (path: string) => number | null;
  hotPathFiles: { path: string }[];
  currentStep: number;
  completedFiles: Set<string>;
}) {
  // Auto-expand directories that contain the selected file
  const containsSelected = shouldAutoExpand(node, selectedPath);
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  const isDir = node.type === "directory";

  // Derive expanded: manual toggle wins, otherwise auto-expand if contains selected or depth < 1
  const autoExpanded = depth < 1 || containsSelected;
  const isExpanded = forceExpand || (manualExpanded !== null ? manualExpanded : autoExpanded);
  const isSelected = selectedPath === node.path;
  const fileStatus = !isDir ? getFileStatus(node.path) : null;

  const handleClick = () => {
    if (isDir) {
      setManualExpanded(!isExpanded);
    } else {
      onFileSelect(node.path);
    }
  };

  const fileIcon = getFileIcon(node.name);
  const rank = !isDir ? getRankForFile(node.path) : null;
  const isCurrentStepFile = !isDir && hotPathFiles.length > 0 && hotPathFiles[currentStep]?.path === node.path;
  const isCompletedFile = !isDir && completedFiles.has(node.path);

  // Compute background style based on status
  let bgClass = "text-slate-700 dark:text-slate-300";
  if (isSelected) {
    bgClass = "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300";
  } else if (fileStatus === "hot-path") {
    bgClass = "bg-orange-50/60 text-orange-800 dark:bg-orange-950/20 dark:text-orange-300";
  } else if (fileStatus === "ai-mentioned") {
    bgClass = "bg-blue-50/60 text-blue-800 dark:bg-blue-950/20 dark:text-blue-300";
  }

  return (
    <div>
      <button
        onClick={handleClick}
        className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 ${bgClass}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {isDir ? (
          <>
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            )}
            {isExpanded ? (
              <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
            ) : (
              <Folder className="h-4 w-4 shrink-0 text-amber-500" />
            )}
          </>
        ) : (
          <>
            <span className="w-3.5 shrink-0" />
            <span className="shrink-0 text-sm">{fileIcon}</span>
          </>
        )}
        <span className="truncate text-xs flex-1">{node.name}</span>
        {!isDir && <StatusIndicator status={fileStatus} rank={rank} isCurrentStep={isCurrentStepFile} isCompleted={isCompletedFile} />}
      </button>

      {isDir && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onFileSelect={onFileSelect}
              forceExpand={forceExpand}
              getFileStatus={getFileStatus}
              getRankForFile={getRankForFile}
              hotPathFiles={hotPathFiles}
              currentStep={currentStep}
              completedFiles={completedFiles}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getFileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const iconMap: Record<string, string> = {
    go: "🔵",
    rs: "🦀",
    ts: "🟦",
    tsx: "🟦",
    js: "🟨",
    jsx: "🟨",
    py: "🐍",
    rb: "💎",
    java: "☕",
    c: "⚙️",
    h: "⚙️",
    cpp: "⚙️",
    md: "📝",
    json: "📋",
    yaml: "📋",
    yml: "📋",
    toml: "📋",
    sql: "🗃️",
    sh: "🖥️",
    bash: "🖥️",
    dockerfile: "🐳",
    css: "🎨",
    html: "🌐",
    svg: "🖼️",
  };

  // Check full filename for special files
  const nameMap: Record<string, string> = {
    "Makefile": "🔧",
    "Dockerfile": "🐳",
    "LICENSE": "📜",
    "README.md": "📖",
    ".gitignore": "🙈",
    "go.mod": "🔵",
    "go.sum": "🔵",
    "Cargo.toml": "🦀",
    "package.json": "📦",
    "tsconfig.json": "🟦",
  };

  return nameMap[name] || iconMap[ext] || "📄";
}
