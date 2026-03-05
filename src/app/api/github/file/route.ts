/**
 * GitHub File Content API
 * GET /api/github/file?owner=xxx&repo=xxx&path=src/main.go&ref=main
 */

import { NextRequest } from "next/server";
import {
  getFileContent,
  decodeFileContent,
  GitHubError,
} from "@/lib/github/client";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  const path = searchParams.get("path");
  const ref = searchParams.get("ref") || undefined;

  if (!owner || !repo || !path) {
    return Response.json(
      { error: "owner, repo and path are required" },
      { status: 400 }
    );
  }

  try {
    const file = await getFileContent(owner, repo, path, ref);

    // Check file size — refuse to decode very large files
    if (file.size > 500 * 1024) {
      return Response.json(
        {
          name: file.name,
          path: file.path,
          size: file.size,
          htmlUrl: file.html_url,
          content: null,
          tooLarge: true,
          message: `文件过大 (${(file.size / 1024).toFixed(0)} KB)，请直接在 GitHub 上查看`,
        },
        { status: 200 }
      );
    }

    const content = decodeFileContent(file.content);

    return Response.json({
      name: file.name,
      path: file.path,
      size: file.size,
      sha: file.sha,
      htmlUrl: file.html_url,
      content,
      tooLarge: false,
    });
  } catch (error) {
    if (error instanceof GitHubError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
