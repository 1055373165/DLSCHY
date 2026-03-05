/**
 * GitHub File Tree API
 * GET /api/github/tree?owner=xxx&repo=xxx&branch=main
 */

import { NextRequest } from "next/server";
import {
  getRepoTree,
  filterTree,
  summarizeProjectStructure,
  GitHubError,
} from "@/lib/github/client";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  const branch = searchParams.get("branch") || undefined;

  if (!owner || !repo) {
    return Response.json(
      { error: "owner and repo are required" },
      { status: 400 }
    );
  }

  try {
    const treeResponse = await getRepoTree(owner, repo, branch);
    const filtered = filterTree(treeResponse.tree);

    // Build hierarchical tree structure for the frontend
    const tree = buildHierarchy(filtered);
    const summary = summarizeProjectStructure(filtered);

    return Response.json({
      sha: treeResponse.sha,
      truncated: treeResponse.truncated,
      totalFiles: filtered.filter((e) => e.type === "blob").length,
      totalDirs: filtered.filter((e) => e.type === "tree").length,
      tree,
      summary,
    });
  } catch (error) {
    if (error instanceof GitHubError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  children?: TreeNode[];
}

function buildHierarchy(
  entries: { path: string; type: "blob" | "tree"; size?: number }[]
): TreeNode[] {
  const root: TreeNode[] = [];
  const map = new Map<string, TreeNode>();

  // Sort: directories first, then alphabetically
  const sorted = [...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === "tree" ? -1 : 1;
    return a.path.localeCompare(b.path);
  });

  for (const entry of sorted) {
    const parts = entry.path.split("/");
    const name = parts[parts.length - 1];
    const node: TreeNode = {
      name,
      path: entry.path,
      type: entry.type === "tree" ? "directory" : "file",
      size: entry.size,
    };

    if (node.type === "directory") {
      node.children = [];
    }

    map.set(entry.path, node);

    if (parts.length === 1) {
      root.push(node);
    } else {
      const parentPath = parts.slice(0, -1).join("/");
      const parent = map.get(parentPath);
      if (parent && parent.children) {
        parent.children.push(node);
      } else {
        root.push(node);
      }
    }
  }

  return root;
}
