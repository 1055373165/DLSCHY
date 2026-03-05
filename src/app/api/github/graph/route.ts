import { NextRequest, NextResponse } from "next/server";
import {
  getFileContent,
  getRepoTree,
  decodeFileContent,
  GitHubError,
  type FileContent,
} from "@/lib/github/client";
import {
  buildDependencyGraph,
  type FileContentProvider,
} from "@/lib/analysis/graph-builder";
import { analyzeHotPath } from "@/lib/analysis/hot-path";
import type { ProjectGraph, GraphNode, GraphEdge, GraphCluster } from "@/types/graph";

/**
 * GET /api/github/graph?owner=X&repo=X
 *
 * Returns ProjectGraph for the North Star overlay (Decision 10).
 * Combines dependency graph data with hot path analysis to produce
 * a global force-directed graph data structure.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");

  if (!owner || !repo) {
    return NextResponse.json(
      { error: "Missing required parameters: owner, repo" },
      { status: 400 }
    );
  }

  try {
    // Global timeout: abort if the entire operation takes > 30s
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 30_000);

    // 1. Fetch the full file tree
    const treeData = await getRepoTree(owner, repo);
    const fileIndex = new Set<string>();
    if (treeData.tree) {
      for (const item of treeData.tree) {
        if (item.type === "blob") {
          fileIndex.add(item.path);
        }
      }
    }

    // 2. Content provider with caching (shared by both analyses)
    const contentCache = new Map<string, string | null>();

    async function getContent(path: string): Promise<string | null> {
      if (abortController.signal.aborted) return null;
      if (contentCache.has(path)) return contentCache.get(path)!;
      try {
        const data: FileContent = await getFileContent(owner!, repo!, path);
        if (data.content && data.size < 500000) {
          const content = decodeFileContent(data.content);
          contentCache.set(path, content);
          return content;
        }
        contentCache.set(path, null);
        return null;
      } catch {
        contentCache.set(path, null);
        return null;
      }
    }

    // 3. Run hot path analysis to identify key files
    const hotPathResult = await analyzeHotPath(fileIndex, getContent, 8);

    if (abortController.signal.aborted) {
      clearTimeout(timeout);
      return NextResponse.json({ error: "Graph analysis timed out" }, { status: 504 });
    }

    const hotPathMap = new Map<string, number>();
    hotPathResult.files.forEach((f, i) => {
      hotPathMap.set(f.path, i + 1);
    });

    // 4. Find the entry point file for graph building
    const entryPoint = hotPathResult.entryPoint || hotPathResult.files[0]?.path;
    if (!entryPoint) {
      clearTimeout(timeout);
      return NextResponse.json(
        { error: "Could not determine entry point" },
        { status: 400 }
      );
    }

    // 5. Fetch entry file content
    const entryContent = await getContent(entryPoint);
    if (!entryContent) {
      clearTimeout(timeout);
      return NextResponse.json(
        { error: "Entry file has no content" },
        { status: 400 }
      );
    }

    // 6. Build dependency graph — reduced depth/nodes for reliability
    const contentProvider: FileContentProvider = { getContent };

    const depGraph = await buildDependencyGraph(entryPoint, entryContent, {
      maxDepth: 2,
      maxNodes: 50,
      fileIndex,
      contentProvider,
    });

    clearTimeout(timeout);

    // 6. Compute PageRank-like scores
    const inDegreeMap = new Map<string, number>();
    const outDegreeMap = new Map<string, number>();
    for (const edge of depGraph.edges) {
      inDegreeMap.set(edge.target, (inDegreeMap.get(edge.target) || 0) + 1);
      outDegreeMap.set(edge.source, (outDegreeMap.get(edge.source) || 0) + 1);
    }
    const maxIn = Math.max(1, ...inDegreeMap.values());

    // 7. Build ProjectGraph nodes
    const nodes: GraphNode[] = depGraph.nodes.map((n) => {
      const inDeg = inDegreeMap.get(n.id) || 0;
      const outDeg = outDegreeMap.get(n.id) || 0;
      const pageRank = inDeg / maxIn;
      const isHotPath = hotPathMap.has(n.filePath);
      return {
        id: n.filePath,
        label: n.filePath,
        type: "file" as const,
        module: n.module,
        metrics: { pageRank, inDegree: inDeg, outDegree: outDeg },
        isHotPath,
        hotPathRank: hotPathMap.get(n.filePath),
        isCompleted: false,
      };
    });

    // 8. Build edges
    const edges: GraphEdge[] = depGraph.edges.map((e) => {
      const srcNode = depGraph.nodes.find((n) => n.id === e.source);
      const tgtNode = depGraph.nodes.find((n) => n.id === e.target);
      const srcPath = srcNode?.filePath || e.source;
      const tgtPath = tgtNode?.filePath || e.target;
      const srcHot = hotPathMap.has(srcPath);
      const tgtHot = hotPathMap.has(tgtPath);
      return {
        source: srcPath,
        target: tgtPath,
        weight: e.weight / Math.max(1, ...depGraph.edges.map((x) => x.weight)),
        isHotPathEdge: srcHot && tgtHot,
      };
    });

    // 9. Build clusters from modules
    const clusterColors = [
      "#6366f1", "#f97316", "#22c55e", "#ec4899",
      "#0ea5e9", "#a855f7", "#eab308", "#14b8a6",
    ];
    const moduleMap = new Map<string, string[]>();
    for (const node of nodes) {
      const list = moduleMap.get(node.module) || [];
      list.push(node.id);
      moduleMap.set(node.module, list);
    }
    const clusters: GraphCluster[] = Array.from(moduleMap.entries()).map(
      ([mod, nodeIds], i) => ({
        id: mod,
        label: mod,
        nodeIds,
        color: clusterColors[i % clusterColors.length],
      })
    );

    const projectGraph: ProjectGraph = { nodes, edges, clusters };

    return NextResponse.json(projectGraph);
  } catch (error) {
    console.error("Graph API error:", error);
    if (error instanceof GitHubError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to build graph" },
      { status: 500 }
    );
  }
}
