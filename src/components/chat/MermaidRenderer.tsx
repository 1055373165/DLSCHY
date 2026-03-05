"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface MermaidRendererProps {
  chart: string;
  className?: string;
}

// Module-level render cache: chart text → SVG string (max 50 entries)
const svgCache = new Map<string, string>();
const CACHE_MAX = 50;

function getCachedSvg(chart: string): string | undefined {
  return svgCache.get(chart);
}

function setCachedSvg(chart: string, svg: string): void {
  if (svgCache.size >= CACHE_MAX) {
    // Evict oldest entry
    const first = svgCache.keys().next().value;
    if (first !== undefined) svgCache.delete(first);
  }
  svgCache.set(chart, svg);
}

const VALID_DIRECTIVES = [
  "graph",
  "flowchart",
  "sequenceDiagram",
  "classDiagram",
  "stateDiagram",
  "erDiagram",
  "gantt",
  "pie",
  "gitGraph",
  "journey",
  "mindmap",
  "timeline",
  "quadrantChart",
  "xychart",
  "sankey",
  "block",
];

function looksLikeCompleteMermaid(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const firstLine = trimmed.split("\n")[0].trim();
  return VALID_DIRECTIVES.some(
    (d) => firstLine.startsWith(d) || firstLine.startsWith(`%%`) || firstLine.startsWith(`---`)
  );
}

export function MermaidRenderer({ chart, className }: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<boolean>(false);
  const [settled, setSettled] = useState(false);
  const [zoom, setZoom] = useState(1);
  const prevChartRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const zoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.2, 3)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.2, 0.2)), []);
  const zoomFit = useCallback(() => {
    if (!containerRef.current) { setZoom(1); return; }
    const svgEl = containerRef.current.querySelector("svg");
    if (!svgEl) { setZoom(1); return; }
    const containerW = containerRef.current.clientWidth - 32;
    const svgW = svgEl.viewBox?.baseVal?.width || svgEl.getBoundingClientRect().width;
    if (svgW > 0) {
      setZoom(Math.min(containerW / svgW, 1.5));
    } else {
      setZoom(1);
    }
  }, []);

  useEffect(() => {
    const chartTrimmed = chart.trim();

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (!looksLikeCompleteMermaid(chartTrimmed)) {
      return;
    }

    prevChartRef.current = chartTrimmed;

    timerRef.current = setTimeout(() => {
      if (prevChartRef.current !== chartTrimmed) return;

      let cancelled = false;

      (async () => {
        try {
          // Check render cache first
          const cached = getCachedSvg(chartTrimmed);
          if (cached) {
            if (!cancelled) {
              setSvg(cached);
              setError(false);
              setSettled(true);
            }
            return;
          }

          const mermaid = (await import("mermaid")).default;
          mermaid.initialize({
            startOnLoad: false,
            theme: "neutral",
            securityLevel: "loose",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            suppressErrorRendering: true,
          });

          const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

          const isValid = await mermaid.parse(chartTrimmed, { suppressErrors: true });
          if (!isValid) {
            if (!cancelled) {
              setError(true);
              setSettled(true);
            }
            return;
          }

          const { svg: rendered } = await mermaid.render(id, chartTrimmed);

          if (!cancelled) {
            setCachedSvg(chartTrimmed, rendered);
            setSvg(rendered);
            setError(false);
            setSettled(true);
          }
        } catch {
          if (!cancelled) {
            setError(true);
            setSettled(true);
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    }, 600);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [chart]);

  // Auto-fit on first render of SVG
  useEffect(() => {
    if (svg && containerRef.current) {
      const timer = setTimeout(zoomFit, 50);
      return () => clearTimeout(timer);
    }
  }, [svg, zoomFit]);

  // Conditional rendering (no early returns after hooks)
  if (!settled) {
    return (
      <div className="my-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
        <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          图表渲染中...
        </div>
        <pre className="overflow-x-auto text-xs text-slate-400">{chart.trim()}</pre>
      </div>
    );
  }

  if (error || !svg) {
    return (
      <div className="my-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
        <p className="mb-2 text-xs font-medium text-amber-700 dark:text-amber-400">
          图表语法有误，显示源码：
        </p>
        <pre className="overflow-x-auto rounded bg-white p-2 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-400">
          {chart.trim()}
        </pre>
      </div>
    );
  }

  return (
    <div className={`my-3 rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/50 ${className || ""}`}>
      {/* Zoom controls */}
      <div className="flex items-center justify-end gap-1 border-b border-slate-100 px-3 py-1.5 dark:border-slate-700">
        <button onClick={zoomOut} className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700" title="缩小">−</button>
        <span className="min-w-[3rem] text-center text-[10px] text-slate-400">{Math.round(zoom * 100)}%</span>
        <button onClick={zoomIn} className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700" title="放大">+</button>
        <button onClick={zoomFit} className="rounded px-2 py-0.5 text-[10px] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700" title="适应宽度">适应</button>
      </div>
      <div
        ref={containerRef}
        className="overflow-auto p-4"
        style={{ maxHeight: "70vh" }}
      >
        <div
          style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: "fit-content" }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );
}
