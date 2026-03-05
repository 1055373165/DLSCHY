/**
 * Hot Path Analyzer
 * 
 * Uses a simplified PageRank algorithm on the import graph to identify
 * the most critical files in a codebase — the "hot path" that unlocks
 * understanding of the project's core mechanism (Decision 6: Hot Path First).
 * 
 * The 28定律 (20/80 rule): understanding ~20% of the core code gives
 * you deeper insight than 95% of developers who only skim the surface.
 */

import { parseImports } from "./import-parser";
import { resolveImportPath } from "./graph-builder";

export interface HotPathResult {
  /** Top files ranked by importance, most important first */
  files: HotPathFile[];
  /** Suggested entry point file (rank #1) */
  entryPoint: string;
  /** Brief structural summary for AI context */
  structureSummary: string;
}

export interface HotPathFile {
  path: string;
  /** PageRank-like score (0-1) */
  score: number;
  /** Number of files that import this file */
  inDegree: number;
  /** Number of files this file imports */
  outDegree: number;
  /** Why this file is important */
  reason: string;
}

/** Well-known entry point patterns by language */
const ENTRY_POINT_PATTERNS: Array<{ pattern: RegExp; boost: number; reason: string }> = [
  // Go
  { pattern: /^(cmd\/[^/]+\/)?main\.go$/, boost: 3.0, reason: "Go main entry point" },
  { pattern: /^server\.go$/, boost: 2.5, reason: "Server entry" },
  { pattern: /^(cmd\/[^/]+\/)?root\.go$/, boost: 2.0, reason: "CLI root command" },
  // Rust
  { pattern: /^src\/main\.rs$/, boost: 3.0, reason: "Rust main entry" },
  { pattern: /^src\/lib\.rs$/, boost: 2.5, reason: "Rust library root" },
  // JS/TS
  { pattern: /^(src\/)?(index|main|app)\.(ts|js|tsx|jsx)$/, boost: 2.5, reason: "JS/TS entry point" },
  { pattern: /^(src\/)?server\.(ts|js)$/, boost: 2.5, reason: "Server entry" },
  // Python
  { pattern: /^(src\/)?(__main__|main|app)\.py$/, boost: 2.5, reason: "Python entry point" },
  { pattern: /^manage\.py$/, boost: 2.0, reason: "Django management" },
  // Java/Kotlin
  { pattern: /Main\.(java|kt)$/, boost: 2.5, reason: "Java/Kotlin main class" },
  { pattern: /Application\.(java|kt)$/, boost: 2.5, reason: "Spring application" },
  // C/C++
  { pattern: /^(src\/)?main\.(c|cpp|cc)$/, boost: 3.0, reason: "C/C++ main entry" },
  // Ruby
  { pattern: /^(lib\/)?[^/]+\.rb$/, boost: 1.5, reason: "Ruby top-level module" },
  // Event loop / core patterns (language-agnostic)
  { pattern: /(event[_-]?loop|reactor|dispatcher|scheduler|engine)\.(go|rs|c|cpp|py|ts|js|java)$/i, boost: 3.0, reason: "Core event loop / reactor" },
  { pattern: /(server|listener|handler|router)\.(go|rs|c|cpp|py|ts|js|java)$/i, boost: 2.0, reason: "Server / request handler" },
];

/** Files to ignore in hot path analysis */
const IGNORE_PATTERNS = [
  /\.(test|spec|_test)\./,
  /test[s]?\//,
  /vendor\//,
  /node_modules\//,
  /\.d\.ts$/,
  /\.(md|txt|json|yaml|yml|toml|lock|sum)$/,
  /\.(css|scss|less|svg|png|jpg|gif)$/,
  /LICENSE/,
  /README/,
  /CHANGELOG/,
  /Makefile$/,
  /Dockerfile$/,
  /\.github\//,
  /\.git\//,
];

function shouldIgnore(path: string): boolean {
  return IGNORE_PATTERNS.some((p) => p.test(path));
}

/**
 * Simplified PageRank on the import graph.
 * 
 * Steps:
 * 1. Build adjacency list from import parsing
 * 2. Run PageRank iterations
 * 3. Apply entry-point pattern boosts
 * 4. Return top N files ranked by score
 */
export async function analyzeHotPath(
  fileIndex: Set<string>,
  getContent: (path: string) => Promise<string | null>,
  topN: number = 8
): Promise<HotPathResult> {
  // Filter to code files only
  const codeFiles = Array.from(fileIndex).filter((f) => !shouldIgnore(f));

  // Build adjacency: who imports whom
  const inEdges = new Map<string, Set<string>>(); // file → set of files that import it
  const outEdges = new Map<string, Set<string>>(); // file → set of files it imports

  for (const f of codeFiles) {
    inEdges.set(f, new Set());
    outEdges.set(f, new Set());
  }

  // Prioritize entry-point-like files, then sort by path depth (shallower first)
  const prioritized = [...codeFiles].sort((a, b) => {
    const aBoost = ENTRY_POINT_PATTERNS.some(({ pattern }) => pattern.test(a)) ? -1000 : 0;
    const bBoost = ENTRY_POINT_PATTERNS.some(({ pattern }) => pattern.test(b)) ? -1000 : 0;
    const depthA = a.split("/").length;
    const depthB = b.split("/").length;
    return (aBoost + depthA) - (bBoost + depthB);
  });

  // Cap files and fetch in parallel batches
  const filesToAnalyze = prioritized.slice(0, 100);
  const BATCH_SIZE = 5;

  for (let batchStart = 0; batchStart < filesToAnalyze.length; batchStart += BATCH_SIZE) {
    const batch = filesToAnalyze.slice(batchStart, batchStart + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (filePath) => {
        const content = await getContent(filePath);
        return { filePath, content };
      })
    );

    for (const { filePath, content } of results) {
      if (!content) continue;

      const imports = parseImports(content, filePath);
      for (const imp of imports) {
        const resolved = resolveImportPath(imp, filePath, fileIndex);
        if (resolved && codeFiles.includes(resolved)) {
          if (!outEdges.has(filePath)) outEdges.set(filePath, new Set());
          outEdges.get(filePath)!.add(resolved);

          if (!inEdges.has(resolved)) inEdges.set(resolved, new Set());
          inEdges.get(resolved)!.add(filePath);
        }
      }
    }
  }

  // PageRank
  const dampingFactor = 0.85;
  const iterations = 20;
  const n = codeFiles.length;
  if (n === 0) {
    return { files: [], entryPoint: "", structureSummary: "No code files found." };
  }

  const scores = new Map<string, number>();
  const initialScore = 1 / n;
  for (const f of codeFiles) {
    scores.set(f, initialScore);
  }

  for (let iter = 0; iter < iterations; iter++) {
    const newScores = new Map<string, number>();
    for (const f of codeFiles) {
      let incomingScore = 0;
      const importers = inEdges.get(f);
      if (importers) {
        for (const importer of importers) {
          const importerOut = outEdges.get(importer)?.size || 1;
          incomingScore += (scores.get(importer) || 0) / importerOut;
        }
      }
      newScores.set(f, (1 - dampingFactor) / n + dampingFactor * incomingScore);
    }
    for (const [f, s] of newScores) {
      scores.set(f, s);
    }
  }

  // Apply entry-point pattern boosts
  for (const file of codeFiles) {
    for (const { pattern, boost } of ENTRY_POINT_PATTERNS) {
      if (pattern.test(file)) {
        scores.set(file, (scores.get(file) || 0) * boost);
        break; // only apply highest matching boost
      }
    }
  }

  // Rank files by score
  const ranked = codeFiles
    .map((f) => ({
      path: f,
      score: scores.get(f) || 0,
      inDegree: inEdges.get(f)?.size || 0,
      outDegree: outEdges.get(f)?.size || 0,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  // Determine reasons
  const results: HotPathFile[] = ranked.map((f) => {
    let reason = "";
    // Check entry-point patterns
    for (const { pattern, reason: r } of ENTRY_POINT_PATTERNS) {
      if (pattern.test(f.path)) {
        reason = r;
        break;
      }
    }
    if (!reason) {
      if (f.inDegree >= 5) {
        reason = `被 ${f.inDegree} 个文件引用的核心模块`;
      } else if (f.inDegree >= 3) {
        reason = `被 ${f.inDegree} 个文件引用的关键依赖`;
      } else if (f.outDegree >= 5) {
        reason = `引用 ${f.outDegree} 个模块的协调者`;
      } else {
        reason = `图结构中的高权重节点`;
      }
    }
    return { ...f, reason };
  });

  const entryPoint = results[0]?.path || "";

  // Build structure summary for AI
  const topFiles = results.slice(0, 5).map((f) => `- \`${f.path}\`: ${f.reason} (被引用${f.inDegree}次, 引用${f.outDegree}个)`).join("\n");
  const structureSummary = `项目核心路径分析 (基于 import 图 PageRank):\n\n入口点: \`${entryPoint}\`\n\nTop-5 关键文件:\n${topFiles}`;

  return { files: results, entryPoint, structureSummary };
}
