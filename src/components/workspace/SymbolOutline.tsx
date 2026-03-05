"use client";

import { useEffect, useMemo } from "react";
import {
  Code2,
  Box,
  Type,
  Hash,
  Braces,
  X,
  Loader2,
  Upload,
} from "lucide-react";
import { useNavigationStore } from "@/stores/navigation-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useHotPathStore } from "@/stores/hotpath-store";
import type { SymbolInfo } from "@/types/analysis";

interface SymbolOutlineProps {
  owner: string;
  repo: string;
  filePath: string | null;
}

const SYMBOL_ICONS: Record<SymbolInfo["kind"], React.ReactNode> = {
  function: <Code2 className="h-3.5 w-3.5 text-blue-500" />,
  class: <Box className="h-3.5 w-3.5 text-amber-500" />,
  type: <Type className="h-3.5 w-3.5 text-emerald-500" />,
  interface: <Braces className="h-3.5 w-3.5 text-purple-500" />,
  constant: <Hash className="h-3.5 w-3.5 text-orange-500" />,
  variable: <Hash className="h-3.5 w-3.5 text-slate-500" />,
  method: <Code2 className="h-3.5 w-3.5 text-cyan-500" />,
  enum: <Braces className="h-3.5 w-3.5 text-pink-500" />,
};

export function SymbolOutline({ owner, repo, filePath }: SymbolOutlineProps) {
  const outlineVisible = useNavigationStore((s) => s.outlineVisible);
  const toggleOutline = useNavigationStore((s) => s.toggleOutline);
  const symbols = useNavigationStore((s) => filePath ? s.getSymbols(filePath) : null);
  const symbolLoading = useNavigationStore((s) => filePath ? s.symbolLoading.has(filePath) : false);
  const setSymbols = useNavigationStore((s) => s.setSymbols);
  const setSymbolLoading = useNavigationStore((s) => s.setSymbolLoading);

  const setScrollToLine = useWorkspaceStore((s) => s.setScrollToLine);
  const hotPathFiles = useHotPathStore((s) => s.files);

  // Hot path file set for marking symbols
  const hotPathFileSet = useMemo(
    () => new Set(hotPathFiles.map((f) => f.path)),
    [hotPathFiles]
  );

  // Fetch symbols when file changes
  useEffect(() => {
    if (!filePath || !outlineVisible || symbols !== null || symbolLoading) return;

    setSymbolLoading(filePath, true);

    fetch(`/api/github/symbols?owner=${owner}&repo=${repo}&path=${encodeURIComponent(filePath)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.symbols) {
          setSymbols(filePath, data.symbols);
        } else {
          setSymbols(filePath, []);
        }
      })
      .catch(() => {
        setSymbols(filePath, []);
      });
  }, [filePath, outlineVisible, symbols, symbolLoading, owner, repo, setSymbols, setSymbolLoading]);

  if (!outlineVisible) return null;

  const isHotPathFile = filePath ? hotPathFileSet.has(filePath) : false;

  return (
    <div className="flex h-full w-52 flex-col border-r border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          符号大纲
        </span>
        <button
          onClick={toggleOutline}
          className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700"
          title="关闭大纲"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!filePath ? (
          <div className="flex h-full items-center justify-center px-3">
            <p className="text-center text-xs text-slate-400">选择文件查看符号</p>
          </div>
        ) : symbolLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          </div>
        ) : symbols && symbols.length > 0 ? (
          <div className="py-1">
            {symbols.map((sym, i) => (
              <SymbolItem
                key={`${sym.name}-${sym.line}-${i}`}
                symbol={sym}
                isHotPathFile={isHotPathFile}
                onClick={() => setScrollToLine(sym.line)}
              />
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center px-3">
            <p className="text-center text-xs text-slate-400">未检测到符号</p>
          </div>
        )}
      </div>

      {/* File info footer */}
      {filePath && symbols && (
        <div className="border-t border-slate-200 px-3 py-1.5 dark:border-slate-800">
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <span>{symbols.length} 个符号</span>
            <span>·</span>
            <span>{symbols.filter((s) => s.exported).length} 导出</span>
          </div>
        </div>
      )}
    </div>
  );
}

function SymbolItem({
  symbol,
  isHotPathFile,
  onClick,
}: {
  symbol: SymbolInfo;
  isHotPathFile: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-1.5 px-3 py-1 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50"
      title={symbol.signature || symbol.name}
    >
      {SYMBOL_ICONS[symbol.kind] || <Hash className="h-3.5 w-3.5 text-slate-400" />}
      <span
        className={`flex-1 truncate text-xs ${
          symbol.exported
            ? "font-medium text-slate-800 dark:text-slate-200"
            : "text-slate-500 dark:text-slate-400"
        }`}
      >
        {symbol.name}
      </span>
      {symbol.exported && (
        <Upload className="h-2.5 w-2.5 shrink-0 text-slate-300 dark:text-slate-600" />
      )}
      {isHotPathFile && symbol.exported && (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
      )}
      <span className="shrink-0 text-[10px] text-slate-300 opacity-0 group-hover:opacity-100 dark:text-slate-600">
        L{symbol.line}
      </span>
    </button>
  );
}
