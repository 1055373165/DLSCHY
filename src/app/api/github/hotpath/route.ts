import { NextRequest, NextResponse } from "next/server";
import {
  getFileContent,
  getRepoTree,
  decodeFileContent,
  GitHubError,
} from "@/lib/github/client";
import { analyzeHotPath } from "@/lib/analysis/hot-path";

/**
 * GET /api/github/hotpath?owner=X&repo=X
 *
 * Identifies the "hot path" — the most critical files in a codebase
 * using PageRank on the import graph + entry-point pattern boosts.
 * 
 * Decision 6: Hot Path First — automatically identify and guide users
 * to the core mechanism without offering choices.
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
    // Timeout: abort if analysis takes > 25s
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 25_000);

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

    // 2. Content provider with caching + abort check
    const contentCache = new Map<string, string | null>();

    async function getContent(path: string): Promise<string | null> {
      if (abortController.signal.aborted) return null;
      if (contentCache.has(path)) return contentCache.get(path)!;
      try {
        const data = await getFileContent(owner!, repo!, path);
        if (data.content && data.size < 300000) {
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

    // 3. Run hot path analysis
    const result = await analyzeHotPath(fileIndex, getContent, 8);
    clearTimeout(timeout);

    if (abortController.signal.aborted) {
      return NextResponse.json({ error: "Hot path analysis timed out" }, { status: 504 });
    }

    return NextResponse.json({
      entryPoint: result.entryPoint,
      files: result.files,
      structureSummary: result.structureSummary,
    });
  } catch (error) {
    console.error("Hot path API error:", error);
    if (error instanceof GitHubError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze hot path" },
      { status: 500 }
    );
  }
}
