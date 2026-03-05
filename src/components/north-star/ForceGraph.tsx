"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import * as d3Force from "d3-force";
import * as d3Selection from "d3-selection";
import * as d3Zoom from "d3-zoom";
import { drag as d3Drag } from "d3-drag";
import type { ProjectGraph } from "@/types/graph";

interface ForceGraphProps {
  graph: ProjectGraph;
  centerFile: string | null;
  filter: "all" | "hotpath" | "module";
  onNodeClick: (nodeId: string) => void;
  onNodeDoubleClick: (nodeId: string) => void;
}

interface SimNode extends d3Force.SimulationNodeDatum {
  id: string;
  label: string;
  module: string;
  pageRank: number;
  inDegree: number;
  outDegree: number;
  isHotPath: boolean;
  hotPathRank?: number;
  isCompleted: boolean;
  isCenter: boolean;
}

interface SimLink extends d3Force.SimulationLinkDatum<SimNode> {
  weight: number;
  isHotPathEdge: boolean;
}

const COLORS = {
  center: "#6366f1",
  hotPath: "#f97316",
  hotPathCompleted: "#22c55e",
  normal: "#94a3b8",
  normalHover: "#64748b",
  edge: "#e2e8f0",
  edgeHotPath: "#fdba74",
  edgeActive: "#818cf8",
  text: "#334155",
  textDim: "#94a3b8",
  clusterBg: [
    "rgba(99,102,241,0.06)",
    "rgba(249,115,22,0.06)",
    "rgba(34,197,94,0.06)",
    "rgba(236,72,153,0.06)",
    "rgba(14,165,233,0.06)",
    "rgba(168,85,247,0.06)",
  ],
};

function nodeRadius(node: SimNode, isCenter: boolean): number {
  const base = 4 + node.pageRank * 40;
  const clamped = Math.max(5, Math.min(base, 24));
  return isCenter ? clamped * 1.5 : clamped;
}

export function ForceGraph({ graph, centerFile, filter, onNodeClick, onNodeDoubleClick }: ForceGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3Force.Simulation<SimNode, SimLink> | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: SimNode } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  // Observe container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDimensions({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Filter nodes/edges based on filter mode
  const getFilteredGraph = useCallback(() => {
    let nodes = graph.nodes;
    let edges = graph.edges;

    if (filter === "hotpath") {
      const hotIds = new Set(nodes.filter((n) => n.isHotPath).map((n) => n.id));
      // Include direct neighbors of hot path nodes
      edges.forEach((e) => {
        if (hotIds.has(e.source) || hotIds.has(e.target)) {
          hotIds.add(e.source);
          hotIds.add(e.target);
        }
      });
      nodes = nodes.filter((n) => hotIds.has(n.id));
      edges = edges.filter((e) => hotIds.has(e.source) && hotIds.has(e.target));
    }

    return { nodes, edges, clusters: graph.clusters };
  }, [graph, filter]);

  // Build and run simulation
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !graph.nodes.length) return;

    const { width, height } = dimensions;
    const { nodes: rawNodes, edges: rawEdges, clusters } = getFilteredGraph();

    // Prepare simulation data
    const simNodes: SimNode[] = rawNodes.map((n) => ({
      id: n.id,
      label: n.label,
      module: n.module,
      pageRank: n.metrics.pageRank,
      inDegree: n.metrics.inDegree,
      outDegree: n.metrics.outDegree,
      isHotPath: n.isHotPath,
      hotPathRank: n.hotPathRank,
      isCompleted: n.isCompleted,
      isCenter: n.id === centerFile,
    }));

    const nodeMap = new Map(simNodes.map((n) => [n.id, n]));
    const simLinks: SimLink[] = rawEdges
      .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
      .map((e) => ({
        source: e.source,
        target: e.target,
        weight: e.weight,
        isHotPathEdge: e.isHotPathEdge,
      }));

    // Cluster color map
    const clusterColorMap = new Map<string, string>();
    clusters.forEach((c, i) => {
      clusterColorMap.set(c.id, COLORS.clusterBg[i % COLORS.clusterBg.length]);
    });

    // Clear previous
    const root = d3Selection.select(svg);
    root.selectAll("*").remove();

    // Container group for zoom/pan
    const g = root.append("g");

    // Zoom behavior
    const zoomBehavior = d3Zoom.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    root.call(zoomBehavior);

    // Draw cluster backgrounds
    const clusterGroup = g.append("g").attr("class", "clusters");
    // We'll position these after simulation ticks

    // Draw edges
    const linkGroup = g.append("g").attr("class", "links");
    const linkElements = linkGroup
      .selectAll("line")
      .data(simLinks)
      .join("line")
      .attr("stroke", (d) => (d.isHotPathEdge ? COLORS.edgeHotPath : COLORS.edge))
      .attr("stroke-width", (d) => (d.isHotPathEdge ? 2 : 1))
      .attr("stroke-opacity", (d) => (d.isHotPathEdge ? 0.8 : 0.4));

    // Draw nodes
    const nodeGroup = g.append("g").attr("class", "nodes");
    const nodeElements = nodeGroup
      .selectAll<SVGGElement, SimNode>("g")
      .data(simNodes)
      .join("g")
      .attr("cursor", "pointer");

    // Apply drag behavior
    const dragBehavior = d3Drag<SVGGElement, SimNode>()
      .on("start", (event, d) => {
        if (!event.active) simulationRef.current?.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulationRef.current?.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
    nodeElements.call(dragBehavior);

    // Node circles
    nodeElements
      .append("circle")
      .attr("r", (d) => nodeRadius(d, d.isCenter))
      .attr("fill", (d) => {
        if (d.isCenter) return COLORS.center;
        if (d.isCompleted) return COLORS.hotPathCompleted;
        if (d.isHotPath) return COLORS.hotPath;
        return COLORS.normal;
      })
      .attr("stroke", (d) => (d.isCenter ? COLORS.center : "transparent"))
      .attr("stroke-width", (d) => (d.isCenter ? 3 : 0))
      .attr("stroke-opacity", 0.3);

    // Center node glow
    nodeElements
      .filter((d) => d.isCenter)
      .append("circle")
      .attr("r", (d) => nodeRadius(d, true) + 6)
      .attr("fill", "none")
      .attr("stroke", COLORS.center)
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.2)
      .attr("class", "animate-pulse");

    // Hot path rank badge
    nodeElements
      .filter((d) => d.isHotPath && d.hotPathRank !== undefined)
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("font-size", "9px")
      .attr("font-weight", "bold")
      .attr("fill", "white")
      .attr("pointer-events", "none")
      .text((d) => (d.isCompleted ? "\u2713" : String(d.hotPathRank)));

    // Labels for larger/important nodes
    nodeElements
      .filter((d) => d.isCenter || d.isHotPath || d.pageRank > 0.05)
      .append("text")
      .attr("dy", (d) => nodeRadius(d, d.isCenter) + 12)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", (d) => (d.isCenter ? COLORS.text : COLORS.textDim))
      .attr("pointer-events", "none")
      .text((d) => {
        const parts = d.label.split("/");
        return parts[parts.length - 1];
      });

    // Click/double-click handlers
    nodeElements.on("click", (event, d) => {
      event.stopPropagation();
      onNodeClick(d.id);
    });
    nodeElements.on("dblclick", (event, d) => {
      event.stopPropagation();
      onNodeDoubleClick(d.id);
    });

    // Hover tooltip
    nodeElements.on("mouseenter", (event, d) => {
      const svgRect = svg.getBoundingClientRect();
      setTooltip({
        x: event.clientX - svgRect.left,
        y: event.clientY - svgRect.top - 10,
        node: d,
      });
    });
    nodeElements.on("mouseleave", () => setTooltip(null));

    // Simulation
    const simulation = d3Force
      .forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        d3Force
          .forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(80)
          .strength((d) => 0.3 + d.weight * 0.5)
      )
      .force("charge", d3Force.forceManyBody().strength(-200).distanceMax(400))
      .force("center", d3Force.forceCenter(width / 2, height / 2))
      .force("collision", d3Force.forceCollide<SimNode>().radius((d) => nodeRadius(d, d.isCenter) + 4))
      .force("x", d3Force.forceX(width / 2).strength(0.05))
      .force("y", d3Force.forceY(height / 2).strength(0.05));

    simulationRef.current = simulation;

    simulation.on("tick", () => {
      linkElements
        .attr("x1", (d) => (d.source as SimNode).x!)
        .attr("y1", (d) => (d.source as SimNode).y!)
        .attr("x2", (d) => (d.target as SimNode).x!)
        .attr("y2", (d) => (d.target as SimNode).y!);

      nodeElements.attr("transform", (d) => `translate(${d.x},${d.y})`);

      // Update cluster backgrounds
      clusterGroup.selectAll("*").remove();
      clusters.forEach((cluster, i) => {
        const clusterNodes = simNodes.filter((n) => cluster.nodeIds.includes(n.id));
        if (clusterNodes.length < 2) return;
        const xs = clusterNodes.map((n) => n.x!);
        const ys = clusterNodes.map((n) => n.y!);
        const pad = 30;
        const minX = Math.min(...xs) - pad;
        const maxX = Math.max(...xs) + pad;
        const minY = Math.min(...ys) - pad;
        const maxY = Math.max(...ys) + pad;

        clusterGroup
          .append("rect")
          .attr("x", minX)
          .attr("y", minY)
          .attr("width", maxX - minX)
          .attr("height", maxY - minY)
          .attr("rx", 12)
          .attr("fill", COLORS.clusterBg[i % COLORS.clusterBg.length])
          .attr("stroke", "none");

        clusterGroup
          .append("text")
          .attr("x", minX + 8)
          .attr("y", minY + 14)
          .attr("font-size", "9px")
          .attr("fill", COLORS.textDim)
          .text(cluster.label);
      });
    });

    // Initial zoom to fit
    simulation.on("end", () => {
      const allX = simNodes.map((n) => n.x!).filter(Boolean);
      const allY = simNodes.map((n) => n.y!).filter(Boolean);
      if (allX.length === 0) return;
      const padding = 60;
      const x0 = Math.min(...allX) - padding;
      const x1 = Math.max(...allX) + padding;
      const y0 = Math.min(...allY) - padding;
      const y1 = Math.max(...allY) + padding;
      const scale = Math.min(width / (x1 - x0), height / (y1 - y0), 1.5);
      const tx = (width - scale * (x0 + x1)) / 2;
      const ty = (height - scale * (y0 + y1)) / 2;
      root
        .transition()
        .duration(500)
        .call(zoomBehavior.transform, d3Zoom.zoomIdentity.translate(tx, ty).scale(scale));
    });

    return () => {
      simulation.stop();
      simulationRef.current = null;
    };
  }, [graph, centerFile, filter, dimensions, getFilteredGraph, onNodeClick, onNodeDoubleClick]);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="h-full w-full"
      />
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900"
          style={{ left: tooltip.x + 10, top: tooltip.y - 40 }}
        >
          <div className="font-medium text-slate-800 dark:text-white">{tooltip.node.label}</div>
          <div className="mt-0.5 text-slate-500">
            模块: {tooltip.node.module} · 引入: {tooltip.node.inDegree} · 导出: {tooltip.node.outDegree}
          </div>
          {tooltip.node.isHotPath && (
            <div className="mt-0.5 text-orange-600">
              热路径 #{tooltip.node.hotPathRank}
              {tooltip.node.isCompleted && " ✓ 已完成"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
