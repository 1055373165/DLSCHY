/**
 * GitHub API 客户端
 * 封装 GitHub REST API 调用，支持可选的 Token 认证
 */

import { ProxyAgent, fetch as undiciFetch } from "undici";

const GITHUB_API_BASE = "https://api.github.com";

// ─── Proxy support ──────────────────────────────────
// Node.js fetch does NOT use system proxy settings.
// Read proxy from env vars so GitHub API calls work behind a proxy (e.g. Clash).
function getProxyUrl(): string | null {
  return (
    process.env.GITHUB_PROXY ||
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    null
  );
}

let cachedDispatcher: ProxyAgent | null = null;
function getDispatcher(): ProxyAgent | null {
  const proxyUrl = getProxyUrl();
  if (!proxyUrl) return null;
  if (!cachedDispatcher) {
    cachedDispatcher = new ProxyAgent(proxyUrl);
  }
  return cachedDispatcher;
}

function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "HappySourceCode/1.0",
  };

  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

const MAX_RETRIES = 1;
const REQUEST_TIMEOUT_MS = 15_000;

// ─── Global concurrency limiter ─────────────────────
// Prevents connection pool exhaustion when multiple endpoints
// fire parallel GitHub API requests simultaneously.
const MAX_CONCURRENT = getProxyUrl() ? 5 : 3;
let inFlight = 0;
const waitQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (inFlight < MAX_CONCURRENT) {
    inFlight++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    waitQueue.push(() => {
      inFlight++;
      resolve();
    });
  });
}

function releaseSlot(): void {
  inFlight--;
  if (waitQueue.length > 0) {
    const next = waitQueue.shift()!;
    next();
  }
}

function isConnectTimeout(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const cause = (error as { cause?: { code?: string } }).cause;
  return cause?.code === "UND_ERR_CONNECT_TIMEOUT";
}

// ─── In-memory response cache (for proxy mode where Next.js cache is bypassed)
const responseCache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function githubFetch<T>(path: string): Promise<T> {
  const url = `${GITHUB_API_BASE}${path}`;

  // Check in-memory cache
  const cached = responseCache.get(url);
  if (cached && cached.expiry > Date.now()) {
    return cached.data as T;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await acquireSlot();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const dispatcher = getDispatcher();
      // Use undici fetch with proxy if configured, otherwise use global fetch with Next.js cache
      const response = dispatcher
        ? await undiciFetch(url, {
            headers: getHeaders(),
            signal: controller.signal,
            dispatcher,
          })
        : await fetch(url, {
            headers: getHeaders(),
            signal: controller.signal,
            next: { revalidate: 300 },
          });

      clearTimeout(timer);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        const remaining = response.headers.get("x-ratelimit-remaining");

        if (response.status === 403 && remaining === "0") {
          throw new GitHubError(
            "GitHub API 请求频率超限。请配置 GITHUB_TOKEN 以提高限额。",
            403
          );
        }

        if (response.status === 404) {
          throw new GitHubError("仓库不存在或为私有仓库", 404);
        }

        // Retry on 5xx server errors
        if (response.status >= 500 && attempt < MAX_RETRIES) {
          lastError = new GitHubError(`GitHub API 错误: ${response.status}`, response.status);
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }

        throw new GitHubError(
          `GitHub API 错误: ${response.status} ${errorBody}`,
          response.status
        );
      }

      const data = await response.json();
      // Cache successful responses in memory
      responseCache.set(url, { data, expiry: Date.now() + CACHE_TTL_MS });
      return data;
    } catch (error) {
      // Don't retry on known non-transient errors
      if (error instanceof GitHubError && error.status < 500) {
        throw error;
      }

      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry connect timeouts — retrying just congests the pool further
      if (isConnectTimeout(error)) {
        throw lastError;
      }

      // Retry on other transient errors
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
    } finally {
      releaseSlot();
    }
  }

  throw lastError || new GitHubError("GitHub API 请求失败", 500);
}

export class GitHubError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
  }
}

// ---------- Types ----------

export interface RepoInfo {
  name: string;
  full_name: string;
  owner: { login: string; avatar_url: string };
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  size: number; // KB
  default_branch: string;
  topics: string[];
  created_at: string;
  updated_at: string;
  html_url: string;
  license: { spdx_id: string; name: string } | null;
}

export interface TreeEntry {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
  url: string;
}

export interface TreeResponse {
  sha: string;
  url: string;
  tree: TreeEntry[];
  truncated: boolean;
}

export interface FileContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  encoding: string;
  content: string; // base64 encoded
  html_url: string;
}

export interface SearchCodeResult {
  total_count: number;
  items: {
    name: string;
    path: string;
    sha: string;
    html_url: string;
    repository: { full_name: string };
  }[];
}

// ---------- API Methods ----------

export async function getRepoInfo(
  owner: string,
  repo: string
): Promise<RepoInfo> {
  return githubFetch<RepoInfo>(`/repos/${owner}/${repo}`);
}

export async function getRepoTree(
  owner: string,
  repo: string,
  branch?: string,
  recursive = true
): Promise<TreeResponse> {
  const ref = branch || "HEAD";
  const suffix = recursive ? "?recursive=1" : "";
  return githubFetch<TreeResponse>(
    `/repos/${owner}/${repo}/git/trees/${ref}${suffix}`
  );
}

export async function getFileContent(
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<FileContent> {
  const query = ref ? `?ref=${ref}` : "";
  return githubFetch<FileContent>(
    `/repos/${owner}/${repo}/contents/${path}${query}`
  );
}

export async function getReadme(
  owner: string,
  repo: string
): Promise<FileContent | null> {
  try {
    return await githubFetch<FileContent>(`/repos/${owner}/${repo}/readme`);
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return null;
    throw e;
  }
}

export function decodeFileContent(content: string): string {
  return Buffer.from(content, "base64").toString("utf-8");
}

/**
 * 解析 GitHub URL 提取 owner 和 repo
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/\s?#]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

/**
 * 过滤文件树 — 排除不重要的文件和目录
 */
export function filterTree(
  tree: TreeEntry[],
  options?: { maxFiles?: number }
): TreeEntry[] {
  const IGNORE_PATTERNS = [
    /^\.git\//,
    /node_modules\//,
    /vendor\//,
    /\.DS_Store$/,
    /\.min\.(js|css)$/,
    /package-lock\.json$/,
    /yarn\.lock$/,
    /pnpm-lock\.yaml$/,
    /go\.sum$/,
    /Cargo\.lock$/,
    /\.svg$/,
    /\.png$/,
    /\.jpg$/,
    /\.jpeg$/,
    /\.gif$/,
    /\.ico$/,
    /\.woff2?$/,
    /\.ttf$/,
    /\.eot$/,
  ];

  const filtered = tree.filter((entry) => {
    return !IGNORE_PATTERNS.some((pattern) => pattern.test(entry.path));
  });

  const max = options?.maxFiles ?? 2000;
  return filtered.slice(0, max);
}

/**
 * 从文件树提取项目结构摘要
 */
export function summarizeProjectStructure(tree: TreeEntry[]): string {
  const dirs = new Set<string>();
  const filesByDir = new Map<string, string[]>();

  for (const entry of tree) {
    if (entry.type === "tree") {
      dirs.add(entry.path);
    } else {
      const parts = entry.path.split("/");
      const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
      const fileName = parts[parts.length - 1];

      if (!filesByDir.has(dir)) filesByDir.set(dir, []);
      filesByDir.get(dir)!.push(fileName);
    }
  }

  // Build a concise directory listing (top 2 levels only)
  const lines: string[] = [];
  const topLevelDirs = [...dirs].filter((d) => !d.includes("/")).sort();

  for (const dir of topLevelDirs) {
    const files = filesByDir.get(dir) || [];
    lines.push(`📁 ${dir}/ (${files.length} files)`);

    // Show sub-directories
    const subDirs = [...dirs]
      .filter((d) => d.startsWith(dir + "/") && d.split("/").length === 2)
      .sort();
    for (const sub of subDirs.slice(0, 10)) {
      const subFiles = filesByDir.get(sub) || [];
      lines.push(`  📁 ${sub.split("/").pop()}/ (${subFiles.length} files)`);
    }
    if (subDirs.length > 10) {
      lines.push(`  ... and ${subDirs.length - 10} more directories`);
    }
  }

  // Root files
  const rootFiles = filesByDir.get(".") || [];
  if (rootFiles.length > 0) {
    lines.push(`📄 Root files: ${rootFiles.join(", ")}`);
  }

  return lines.join("\n");
}
