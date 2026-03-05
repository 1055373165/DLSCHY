/**
 * GitHub Repo Info API
 * GET /api/github/repo?owner=xxx&repo=xxx
 */

import { NextRequest } from "next/server";
import {
  getRepoInfo,
  getReadme,
  decodeFileContent,
  GitHubError,
} from "@/lib/github/client";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");

  if (!owner || !repo) {
    return Response.json(
      { error: "owner and repo are required" },
      { status: 400 }
    );
  }

  try {
    const [repoInfo, readme] = await Promise.all([
      getRepoInfo(owner, repo),
      getReadme(owner, repo),
    ]);

    return Response.json({
      name: repoInfo.name,
      fullName: repoInfo.full_name,
      owner: repoInfo.owner.login,
      ownerAvatar: repoInfo.owner.avatar_url,
      description: repoInfo.description,
      language: repoInfo.language,
      stars: repoInfo.stargazers_count,
      forks: repoInfo.forks_count,
      size: repoInfo.size,
      defaultBranch: repoInfo.default_branch,
      topics: repoInfo.topics,
      license: repoInfo.license?.spdx_id || null,
      createdAt: repoInfo.created_at,
      updatedAt: repoInfo.updated_at,
      htmlUrl: repoInfo.html_url,
      readme: readme ? decodeFileContent(readme.content) : null,
    });
  } catch (error) {
    if (error instanceof GitHubError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
