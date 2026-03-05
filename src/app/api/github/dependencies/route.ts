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
  toMermaidL1,
  toMermaidL2,
  toMermaidL3,
  type FileContentProvider,
} from "@/lib/analysis/graph-builder";

/**
 * GET /api/github/dependencies?owner=X&repo=X&path=X&depth=2
 *
 * 返回文件依赖拓扑图（三层）:
 * - L1: Import Graph (Mermaid + JSON)
 * - L2: Call Chain (Mermaid + JSON)
 * - L3: Module Cluster (Mermaid + JSON)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  const filePath = searchParams.get("path");
  const depth = Math.min(parseInt(searchParams.get("depth") || "2"), 3);

  if (!owner || !repo || !filePath) {
    return NextResponse.json(
      { error: "Missing required parameters: owner, repo, path" },
      { status: 400 }
    );
  }

  try {
    // 1. Fetch the focus file content
    const fileData = await getFileContent(owner, repo, filePath);

    if (!fileData.content) {
      return NextResponse.json(
        { error: "File has no content" },
        { status: 400 }
      );
    }

    const focusContent = decodeFileContent(fileData.content);

    // 2. Fetch the full file tree to build a file index
    const treeData = await getRepoTree(owner, repo);

    const fileIndex = new Set<string>();
    if (treeData.tree) {
      for (const item of treeData.tree) {
        if (item.type === "blob") {
          fileIndex.add(item.path);
        }
      }
    }

    // 3. Create a content provider that fetches from GitHub
    const contentCache = new Map<string, string | null>();
    contentCache.set(filePath, focusContent);

    const contentProvider: FileContentProvider = {
      async getContent(path: string): Promise<string | null> {
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
      },
    };

    // 4. Build the dependency graph
    const graph = await buildDependencyGraph(filePath, focusContent, {
      maxDepth: depth,
      maxNodes: 40,
      fileIndex,
      contentProvider,
    });

    // 5. Generate Mermaid diagrams for all three layers
    const mermaidL1 = toMermaidL1(graph);
    const mermaidL2 = toMermaidL2(graph);
    const mermaidL3 = toMermaidL3(graph);

    return NextResponse.json({
      focusFile: filePath,
      stats: {
        totalNodes: graph.nodes.length,
        totalEdges: graph.edges.length,
        callChains: graph.callChains.length,
        modules: graph.modules.length,
      },
      mermaid: {
        l1: mermaidL1,
        l2: mermaidL2,
        l3: mermaidL3,
      },
      graph,
    });
  } catch (error) {
    console.error("Dependencies API error:", error);
    if (error instanceof GitHubError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to build dependency graph" },
      { status: 500 }
    );
  }
}
