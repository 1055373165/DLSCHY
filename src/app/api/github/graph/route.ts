import { NextRequest, NextResponse } from "next/server";
import {
  getFileContent,
  getRepoTree,
  decodeFileContent,
  GitHubError,
  type FileContent,
} from "@/lib/github/client";
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
    // Get up to 100 most important files and their full global edge connections.
    const hotPathResult = await analyzeHotPath(fileIndex, getContent, 100);

    if (abortController.signal.aborted) {
      clearTimeout(timeout);
      return NextResponse.json({ error: "Graph analysis timed out" }, { status: 504 });
    }

    clearTimeout(timeout);

    const hotPathMap = new Map<string, number>();
    hotPathResult.files.forEach((f, i) => {
      // the index represents the hot path rank
      hotPathMap.set(f.path, i + 1);
    });

    const maxIn = Math.max(1, ...hotPathResult.files.map((f) => f.inDegree));

    // 4. Build ProjectGraph nodes from the global top 100 files
    const nodes: GraphNode[] = hotPathResult.files.map((f) => {
      const pageRank = f.inDegree / maxIn;
      // Define a simple heuristics to derive module name if not directly available
      const moduleStr = f.path.split("/").length > 2
        ? f.path.split("/").slice(0, 2).join("/")
        : (f.path.split("/")[0] || "/");

      return {
        id: f.path,
        label: f.path,
        type: "file" as const,
        module: moduleStr,
        metrics: { pageRank, inDegree: f.inDegree, outDegree: f.outDegree },
        isHotPath: true, // all top 100 are considered part of the core graph
        hotPathRank: hotPathMap.get(f.path),
        isCompleted: false,
      };
    });

    // 5. Build edges from HotPathResult (global connections)
    // We only include edges connecting our returned top 100 files.
    const validNodeIds = new Set(nodes.map(n => n.id));
    const edges: GraphEdge[] = hotPathResult.edges
      .filter((e) => validNodeIds.has(e.source) && validNodeIds.has(e.target))
      .map((e) => {
        return {
          source: e.source,
          target: e.target,
          weight: 1, // we default to 1 as we don't have symbol-level import breakdown globally
          isHotPathEdge: true,
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
