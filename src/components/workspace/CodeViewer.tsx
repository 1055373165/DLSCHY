"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Loader2, ExternalLink, FileCode, MessageSquare, Lightbulb } from "lucide-react";
import { CodeBlock } from "@/components/chat/CodeBlock";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useHotPathStore } from "@/stores/hotpath-store";

interface CodeViewerProps {
  owner: string;
  repo: string;
  filePath: string | null;
}

function getLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const langMap: Record<string, string> = {
    go: "go",
    rs: "rust",
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    py: "python",
    rb: "ruby",
    java: "java",
    c: "c",
    h: "c",
    cpp: "cpp",
    cs: "csharp",
    md: "markdown",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    sql: "sql",
    sh: "bash",
    bash: "bash",
    dockerfile: "dockerfile",
    css: "css",
    html: "html",
    xml: "xml",
    proto: "protobuf",
  };
  return langMap[ext] || ext;
}

/** Floating action bar shown when user selects code text */
function SelectionActionBar({
  position,
  onExplain,
  onDesignIntent,
}: {
  position: { x: number; y: number };
  onExplain: () => void;
  onDesignIntent: () => void;
}) {
  return (
    <div
      className="fixed z-50 flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-1.5 py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
      style={{ left: position.x, top: position.y }}
    >
      <button
        onClick={onExplain}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        解释代码
      </button>
      <button
        onClick={onDesignIntent}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
      >
        <Lightbulb className="h-3.5 w-3.5" />
        设计意图
      </button>
    </div>
  );
}

export function CodeViewer({ owner, repo, filePath }: CodeViewerProps) {
  const scrollToLine = useWorkspaceStore((s) => s.scrollToLine);
  const selectCode = useWorkspaceStore((s) => s.selectCode);
  const setScrollToLine = useWorkspaceStore((s) => s.setScrollToLine);
  const updateDwellTime = useHotPathStore((s) => s.updateDwellTime);
  const hotPathReady = useHotPathStore((s) => s.ready);
  const getRankForFile = useHotPathStore((s) => s.getRankForFile);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [htmlUrl, setHtmlUrl] = useState<string | null>(null);
  const [selectionBar, setSelectionBar] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState<string>("");
  const codeContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filePath) {
      setContent(null);
      return;
    }

    let cancelled = false;

    async function fetchFile() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ owner, repo, path: filePath! });
        const res = await fetch(`/api/github/file?${params}`);
        const data = await res.json();

        if (cancelled) return;

        if (!res.ok) {
          setError(data.error || "加载失败");
          return;
        }

        if (data.tooLarge) {
          setError(data.message);
          setHtmlUrl(data.htmlUrl);
          return;
        }

        setContent(data.content);
        setHtmlUrl(data.htmlUrl);
      } catch {
        if (!cancelled) setError("网络错误，请重试");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchFile();
    return () => {
      cancelled = true;
    };
  }, [owner, repo, filePath]);

  // Scroll to line when requested by shared state
  useEffect(() => {
    if (scrollToLine && scrollContainerRef.current && content) {
      const lineHeight = 20;
      const targetScroll = (scrollToLine - 1) * lineHeight;
      scrollContainerRef.current.scrollTo({ top: targetScroll, behavior: "smooth" });
      setScrollToLine(null);
    }
  }, [scrollToLine, content, setScrollToLine]);

  // Decision 8: Dwell time tracking for hot path files (>30s = auto-complete)
  useEffect(() => {
    if (!filePath || !hotPathReady) return;
    const rank = getRankForFile(filePath);
    if (rank === null) return; // not a hot-path file

    const interval = setInterval(() => {
      updateDwellTime(filePath!, 5);
    }, 5000);

    return () => clearInterval(interval);
  }, [filePath, hotPathReady, getRankForFile, updateDwellTime]);

  // Listen for text selection on the code container
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !filePath) {
      setSelectionBar(null);
      setSelectedText("");
      return;
    }

    const text = selection.toString().trim();
    if (!text || text.length < 5) {
      setSelectionBar(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    setSelectedText(text);
    setSelectionBar({
      x: Math.min(rect.left + rect.width / 2 - 100, window.innerWidth - 260),
      y: rect.top - 45,
    });
  }, [filePath]);

  // Dismiss selection bar on click elsewhere
  useEffect(() => {
    const handleClickOutside = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setSelectionBar(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Estimate line numbers from selected text position
  const getSelectionLineRange = useCallback((): { start: number; end: number } => {
    if (!content || !selectedText) return { start: 1, end: 1 };
    const idx = content.indexOf(selectedText);
    if (idx === -1) return { start: 1, end: 1 };
    const before = content.substring(0, idx);
    const startLine = (before.match(/\n/g) || []).length + 1;
    const endLine = startLine + (selectedText.match(/\n/g) || []).length;
    return { start: startLine, end: endLine };
  }, [content, selectedText]);

  const handleExplain = useCallback(() => {
    if (!filePath || !selectedText) return;
    const { start, end } = getSelectionLineRange();
    selectCode({ file: filePath, startLine: start, endLine: end, text: selectedText });
    setSelectionBar(null);
    window.getSelection()?.removeAllRanges();
  }, [filePath, selectedText, getSelectionLineRange, selectCode]);

  const handleDesignIntent = useCallback(() => {
    if (!filePath || !selectedText) return;
    const { start, end } = getSelectionLineRange();
    selectCode({
      file: filePath,
      startLine: start,
      endLine: end,
      text: `[设计意图] ${selectedText}`,
    });
    setSelectionBar(null);
    window.getSelection()?.removeAllRanges();
  }, [filePath, selectedText, getSelectionLineRange, selectCode]);

  if (!filePath) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        <div className="text-center">
          <FileCode className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="text-sm">点击左侧文件树选择文件查看</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500">
        <p className="text-sm">{error}</p>
        {htmlUrl && (
          <a
            href={htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-indigo-600 hover:underline"
          >
            在 GitHub 上查看
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    );
  }

  const language = getLanguage(filePath);

  return (
    <div className="relative h-full overflow-auto" ref={scrollContainerRef}>
      {/* File header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <span className="truncate text-xs font-medium text-slate-600 dark:text-slate-400">
          {filePath}
        </span>
        {htmlUrl && (
          <a
            href={htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {/* Code content — selection triggers floating action bar */}
      <div className="p-2" ref={codeContainerRef} onMouseUp={handleMouseUp}>
        {content && <CodeBlock code={content} language={language} />}
      </div>

      {/* Floating selection action bar */}
      {selectionBar && (
        <SelectionActionBar
          position={selectionBar}
          onExplain={handleExplain}
          onDesignIntent={handleDesignIntent}
        />
      )}
    </div>
  );
}
