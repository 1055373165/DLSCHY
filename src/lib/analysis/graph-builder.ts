/**
 * 依赖图构建器
 * 整合 L1 Import、L2 Call Chain、L3 Module Cluster
 * 从焦点文件出发 BFS 展开，构建完整拓扑图数据
 */

import { parseImports, type ImportEntry } from "./import-parser";
import { analyzeFile, type ExportedSymbol, type FunctionCall } from "./call-analyzer";

// ─── 图数据结构 ─────────────────────────────────────

export interface GraphNode {
  id: string;
  label: string;
  /** 文件完整路径 */
  filePath: string;
  /** 节点角色 */
  role: "focus" | "direct" | "indirect" | "external";
  /** 所属模块（目录） */
  module: string;
  /** 导出的符号 */
  exports: ExportedSymbol[];
  /** 引用计数（被多少文件引用） */
  weight: number;
  /** 文件类型/语言 */
  language: string | null;
}

export interface GraphEdge {
  source: string;
  target: string;
  /** 边的语义 */
  kind: "imports" | "calls" | "implements" | "type-ref";
  /** 具体导入/调用的符号 */
  symbols: string[];
  /** 边的权重（符号数量） */
  weight: number;
}

export interface ModuleCluster {
  id: string;
  label: string;
  /** 目录路径 */
  dirPath: string;
  /** 包含的文件节点 ID */
  nodeIds: string[];
  /** 文件数量 */
  fileCount: number;
}

export interface ModuleEdge {
  source: string;
  target: string;
  /** 模块间的依赖边数 */
  weight: number;
  /** 涉及的具体文件对 */
  filePairs: Array<{ from: string; to: string }>;
}

export interface DependencyGraph {
  /** L1: 文件级节点和边 */
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** L2: 调用链信息（附加到 edges 上，kind="calls"） */
  callChains: GraphEdge[];
  /** L3: 模块聚合 */
  modules: ModuleCluster[];
  moduleEdges: ModuleEdge[];
  /** 焦点文件 */
  focusFile: string;
}

// ─── 路径解析工具 ─────────────────────────────────────

function getModule(filePath: string): string {
  const parts = filePath.split("/");
  // Use top 2 levels as module identifier
  if (parts.length <= 2) return parts[0] || "/";
  return parts.slice(0, 2).join("/");
}

function getModuleLabel(dirPath: string): string {
  return dirPath || "/";
}

function nodeId(filePath: string): string {
  return filePath.replace(/[^a-zA-Z0-9_]/g, "_");
}

/**
 * 尝试将 import 路径解析为仓库中的实际文件路径
 * fileIndex: 仓库中所有文件路径的集合
 */
export function resolveImportPath(
  importEntry: ImportEntry,
  currentFilePath: string,
  fileIndex: Set<string>
): string | null {
  // Skip stdlib
  if (importEntry.kind === "stdlib") {
    return null;
  }

  // For relative imports (JS/TS/Python)
  if (importEntry.kind === "relative" && importEntry.resolved) {
    const currentDir = currentFilePath.split("/").slice(0, -1).join("/");
    const resolved = normalizePath(currentDir + "/" + importEntry.resolved);

    // Try exact match, then with extensions
    const extensions = ["", ".ts", ".tsx", ".js", ".jsx", ".go", ".py", ".rs", ".java", "/index.ts", "/index.tsx", "/index.js", "/mod.rs"];
    for (const ext of extensions) {
      const candidate = resolved + ext;
      if (fileIndex.has(candidate)) return candidate;
    }
  }

  // For Go — try matching by suffix in the file index
  // Go imports like "k8s.io/kubernetes/pkg/api" → look for files under pkg/api/
  if (importEntry.kind === "module" || importEntry.kind === "external") {
    // Try matching the last 2-3 segments as directory prefix
    const segments = importEntry.raw.split("/");
    for (let i = Math.max(0, segments.length - 3); i < segments.length; i++) {
      const suffix = segments.slice(i).join("/");
      for (const f of fileIndex) {
        if (f.startsWith(suffix + "/")) {
          return suffix; // Return the directory prefix instead of a single arbitrary file
        }
        if (f === suffix) {
          return f; // Exact file match
        }
      }
    }
  }

  // For C/C++ includes
  if (importEntry.resolved) {
    const currentDir = currentFilePath.split("/").slice(0, -1).join("/");
    const candidates = [
      importEntry.resolved,
      currentDir + "/" + importEntry.resolved,
    ];
    for (const c of candidates) {
      const norm = normalizePath(c);
      if (fileIndex.has(norm)) return norm;
    }
  }

  return null;
}

function normalizePath(p: string): string {
  const parts = p.split("/");
  const result: string[] = [];
  for (const part of parts) {
    if (part === "." || part === "") continue;
    if (part === "..") {
      result.pop();
    } else {
      result.push(part);
    }
  }
  return result.join("/");
}

// ─── 图构建核心 ─────────────────────────────────────

export interface FileContentProvider {
  getContent(filePath: string): Promise<string | null>;
}

export interface BuildOptions {
  /** BFS 展开深度 (default: 2) */
  maxDepth?: number;
  /** 最大节点数 (default: 50) */
  maxNodes?: number;
  /** 仓库文件列表 */
  fileIndex: Set<string>;
  /** 文件内容获取器 */
  contentProvider: FileContentProvider;
}

export async function buildDependencyGraph(
  focusFilePath: string,
  focusContent: string,
  options: BuildOptions
): Promise<DependencyGraph> {
  const maxDepth = options.maxDepth ?? 2;
  const maxNodes = options.maxNodes ?? 50;
  const { fileIndex, contentProvider } = options;

  const nodesMap = new Map<string, GraphNode>();
  const edgesMap = new Map<string, GraphEdge>();
  const callEdges: GraphEdge[] = [];

  // BFS queue: [filePath, content, depth]
  const queue: Array<[string, string, number]> = [[focusFilePath, focusContent, 0]];
  const visited = new Set<string>();
  visited.add(focusFilePath);

  // Add focus node
  const focusAnalysis = analyzeFile(focusContent, focusFilePath);
  nodesMap.set(focusFilePath, {
    id: nodeId(focusFilePath),
    label: focusFilePath.split("/").pop() || focusFilePath,
    filePath: focusFilePath,
    role: "focus",
    module: getModule(focusFilePath),
    exports: focusAnalysis.exports,
    weight: 0,
    language: null,
  });

  while (queue.length > 0 && nodesMap.size < maxNodes) {
    // Process current BFS level in batches for concurrency
    const current = queue.splice(0, Math.min(queue.length, 5));
    const pendingFetches: Array<{ resolvedPath: string; currentPath: string; imp: ImportEntry; depth: number }> = [];

    // First pass: gather all files that need fetching at this BFS step
    for (const [currentPath, currentContent, depth] of current) {
      if (depth > maxDepth) continue;

      const imports = parseImports(currentContent, currentPath);
      const analysis = analyzeFile(currentContent, currentPath);

      for (const imp of imports) {
        const resolvedPath = resolveImportPath(imp, currentPath, fileIndex);

        if (resolvedPath && !nodesMap.has(resolvedPath) && !visited.has(resolvedPath) && nodesMap.size + pendingFetches.length < maxNodes) {
          visited.add(resolvedPath);
          pendingFetches.push({ resolvedPath, currentPath, imp, depth });
        }

        // Add import edge (does not need content)
        const targetPath = resolvedPath || imp.raw;
        const edgeKey = `${currentPath}→${targetPath}`;
        if (!edgesMap.has(edgeKey)) {
          if (!nodesMap.has(targetPath) && !resolvedPath && imp.kind === "external") {
            if (nodesMap.size < maxNodes) {
              nodesMap.set(targetPath, {
                id: nodeId(targetPath),
                label: imp.raw.split("/").pop() || imp.raw,
                filePath: targetPath,
                role: "external",
                module: "external",
                exports: [],
                weight: 0,
                language: null,
              });
            }
          }

          if (nodesMap.has(targetPath)) {
            edgesMap.set(edgeKey, {
              source: nodeId(currentPath),
              target: nodeId(targetPath),
              kind: "imports",
              symbols: imp.symbols,
              weight: Math.max(1, imp.symbols.length),
            });
            const targetNode = nodesMap.get(targetPath);
            if (targetNode) targetNode.weight++;
          }
        }

        // L2: Match calls to exports (for already-loaded nodes)
        if (resolvedPath && nodesMap.has(resolvedPath)) {
          const targetNode = nodesMap.get(resolvedPath)!;
          const matchedCalls = matchCallsToExports(analysis.calls, targetNode.exports, imp);
          if (matchedCalls.length > 0) {
            callEdges.push({
              source: nodeId(currentPath),
              target: nodeId(resolvedPath),
              kind: "calls",
              symbols: matchedCalls,
              weight: matchedCalls.length,
            });
            const typeSymbols = matchedCalls.filter((s) => {
              const exp = targetNode.exports.find((e) => e.name === s);
              return exp && (exp.kind === "type" || exp.kind === "interface");
            });
            if (typeSymbols.length > 0) {
              callEdges.push({
                source: nodeId(currentPath),
                target: nodeId(resolvedPath),
                kind: "type-ref",
                symbols: typeSymbols,
                weight: typeSymbols.length,
              });
            }
          }
        }
      }
    }

    // Batch-fetch all pending files concurrently
    if (pendingFetches.length > 0) {
      const BATCH = 5;
      for (let i = 0; i < pendingFetches.length; i += BATCH) {
        const slice = pendingFetches.slice(i, i + BATCH);
        const fetched = await Promise.all(
          slice.map(async ({ resolvedPath }) => ({
            resolvedPath,
            content: await contentProvider.getContent(resolvedPath),
          }))
        );

        for (let j = 0; j < fetched.length; j++) {
          const { resolvedPath, content } = fetched[j];
          const { currentPath, imp, depth } = slice[j];
          const fileAnalysis = content ? analyzeFile(content, resolvedPath) : { exports: [], calls: [] };

          if (!nodesMap.has(resolvedPath) && nodesMap.size < maxNodes) {
            nodesMap.set(resolvedPath, {
              id: nodeId(resolvedPath),
              label: resolvedPath.split("/").pop() || resolvedPath,
              filePath: resolvedPath,
              role: depth === 0 ? "direct" : "indirect",
              module: getModule(resolvedPath),
              exports: fileAnalysis.exports,
              weight: 0,
              language: null,
            });
          }

          // Add edge if not yet added
          const targetPath = resolvedPath;
          const edgeKey = `${currentPath}→${targetPath}`;
          if (!edgesMap.has(edgeKey) && nodesMap.has(targetPath)) {
            edgesMap.set(edgeKey, {
              source: nodeId(currentPath),
              target: nodeId(targetPath),
              kind: "imports",
              symbols: imp.symbols,
              weight: Math.max(1, imp.symbols.length),
            });
            const targetNode = nodesMap.get(targetPath);
            if (targetNode) targetNode.weight++;
          }

          // Enqueue for further BFS
          if (content && depth + 1 <= maxDepth) {
            queue.push([resolvedPath, content, depth + 1]);
          }
        }
      }
    }
  }

  // L3: Build module clusters
  const { modules, moduleEdges } = buildModuleClusters(nodesMap, edgesMap);

  return {
    nodes: Array.from(nodesMap.values()),
    edges: Array.from(edgesMap.values()),
    callChains: callEdges,
    modules,
    moduleEdges,
    focusFile: focusFilePath,
  };
}

function matchCallsToExports(
  calls: FunctionCall[],
  exports: ExportedSymbol[],
  imp: ImportEntry
): string[] {
  const matched: string[] = [];
  const exportNames = new Set(exports.map((e) => e.name));

  // Match imported symbols that appear in calls
  for (const sym of imp.symbols) {
    if (exportNames.has(sym)) {
      matched.push(sym);
    }
  }

  // Match function calls that reference this import's symbols
  for (const call of calls) {
    const callName = call.name.includes(".") ? call.name.split(".").pop()! : call.name;
    if (exportNames.has(callName) && !matched.includes(callName)) {
      matched.push(callName);
    }
  }

  return matched;
}

// ─── L3: Module Cluster ─────────────────────────────

function buildModuleClusters(
  nodesMap: Map<string, GraphNode>,
  edgesMap: Map<string, GraphEdge>
): { modules: ModuleCluster[]; moduleEdges: ModuleEdge[] } {
  // Group nodes by module
  const moduleMap = new Map<string, string[]>();
  for (const [path, node] of nodesMap) {
    if (node.role === "external") continue;
    const mod = node.module;
    if (!moduleMap.has(mod)) moduleMap.set(mod, []);
    moduleMap.get(mod)!.push(path);
  }

  const modules: ModuleCluster[] = [];
  for (const [mod, filePaths] of moduleMap) {
    modules.push({
      id: `mod_${nodeId(mod)}`,
      label: getModuleLabel(mod),
      dirPath: mod,
      nodeIds: filePaths.map(nodeId),
      fileCount: filePaths.length,
    });
  }

  // Build module-level edges
  const moduleEdgeMap = new Map<string, ModuleEdge>();
  for (const edge of edgesMap.values()) {
    const sourceNode = findNodeById(nodesMap, edge.source);
    const targetNode = findNodeById(nodesMap, edge.target);
    if (!sourceNode || !targetNode) continue;
    if (sourceNode.module === targetNode.module) continue;
    if (sourceNode.role === "external" || targetNode.role === "external") continue;

    const key = `${sourceNode.module}→${targetNode.module}`;
    if (!moduleEdgeMap.has(key)) {
      moduleEdgeMap.set(key, {
        source: `mod_${nodeId(sourceNode.module)}`,
        target: `mod_${nodeId(targetNode.module)}`,
        weight: 0,
        filePairs: [],
      });
    }
    const me = moduleEdgeMap.get(key)!;
    me.weight++;
    me.filePairs.push({ from: sourceNode.filePath, to: targetNode.filePath });
  }

  return {
    modules,
    moduleEdges: Array.from(moduleEdgeMap.values()),
  };
}

function findNodeById(
  nodesMap: Map<string, GraphNode>,
  id: string
): GraphNode | undefined {
  for (const node of nodesMap.values()) {
    if (node.id === id) return node;
  }
  return undefined;
}

// ─── Mermaid 生成器 ──────────────────────────────────

export type MermaidDirection = "LR" | "TB" | "RL" | "BT";

export function toMermaidL1(graph: DependencyGraph, direction: MermaidDirection = "LR"): string {
  const lines: string[] = [`graph ${direction}`];

  // Style for focus node
  const focusNode = graph.nodes.find((n) => n.role === "focus");

  for (const node of graph.nodes) {
    const lbl = sanitizeLabel(node.label);
    const shape = node.role === "focus" ? `[["${lbl}"]]`
      : node.role === "external" ? `>"${lbl}"]`
        : `["${lbl}"]`;
    lines.push(`  ${node.id}${shape}`);
  }

  for (const edge of graph.edges) {
    const label = edge.symbols.length > 0
      ? sanitizeLabel(edge.symbols.slice(0, 3).join(", ") + (edge.symbols.length > 3 ? "..." : ""))
      : "";
    const arrow = edge.kind === "imports" ? "-->" : "-..->";
    if (label) {
      lines.push(`  ${edge.source} ${arrow}|"${label}"| ${edge.target}`);
    } else {
      lines.push(`  ${edge.source} ${arrow} ${edge.target}`);
    }
  }

  // Styling
  if (focusNode) {
    lines.push(`  style ${focusNode.id} fill:#6366f1,stroke:#4f46e5,color:#fff,stroke-width:2px`);
  }
  for (const node of graph.nodes) {
    if (node.role === "direct") {
      lines.push(`  style ${node.id} fill:#e0e7ff,stroke:#6366f1,color:#312e81`);
    } else if (node.role === "external") {
      lines.push(`  style ${node.id} fill:#fef3c7,stroke:#d97706,color:#92400e`);
    }
  }

  return lines.join("\n");
}

/** Sanitize text for use inside Mermaid labels */
function sanitizeLabel(text: string): string {
  return text.replace(/"/g, "#quot;").replace(/[<>{}|]/g, " ");
}

export function toMermaidL2(graph: DependencyGraph, direction: MermaidDirection = "TB"): string {
  // If no call chains found, fall back to import edges
  if (graph.callChains.length === 0) {
    return toMermaidL1(graph, direction);
  }

  const lines: string[] = [`graph ${direction}`];
  const focusNode = graph.nodes.find((n) => n.role === "focus");

  // Build a function-level flow graph:
  // Each call chain edge has source file → target file with symbols.
  // Create nodes per file, and show the call symbols on edges.
  // Group by source→target pair, merge symbols.
  const pairMap = new Map<string, { source: string; target: string; calls: string[]; types: string[] }>();

  for (const edge of graph.callChains) {
    const key = `${edge.source}→${edge.target}`;
    if (!pairMap.has(key)) {
      pairMap.set(key, { source: edge.source, target: edge.target, calls: [], types: [] });
    }
    const pair = pairMap.get(key)!;
    if (edge.kind === "calls") {
      pair.calls.push(...edge.symbols);
    } else {
      pair.types.push(...edge.symbols);
    }
  }

  // Collect involved node IDs
  const involvedIds = new Set<string>();
  for (const edge of graph.callChains) {
    involvedIds.add(edge.source);
    involvedIds.add(edge.target);
  }
  if (focusNode) involvedIds.add(focusNode.id);

  // Emit file nodes with their key exported symbols
  for (const node of graph.nodes) {
    if (!involvedIds.has(node.id)) continue;
    const fileName = sanitizeLabel(node.label);
    // Show top exported symbols as sub-label
    const keySymbols = node.exports
      .filter((e) => e.kind === "function" || e.kind === "method" || e.kind === "struct")
      .slice(0, 4)
      .map((e) => sanitizeLabel(e.name));
    const subLabel = keySymbols.length > 0 ? `<br/><i>${keySymbols.join(", ")}</i>` : "";
    const shape = node.role === "focus"
      ? `[["${fileName}${subLabel}"]]`
      : `["${fileName}${subLabel}"]`;
    lines.push(`  ${node.id}${shape}`);
  }

  // Emit call edges with function names as labels
  for (const [, pair] of pairMap) {
    if (pair.calls.length > 0) {
      const label = sanitizeLabel(pair.calls.slice(0, 4).join(", ") + (pair.calls.length > 4 ? "..." : ""));
      lines.push(`  ${pair.source} ==>|"${label}"| ${pair.target}`);
    }
    if (pair.types.length > 0) {
      const label = sanitizeLabel(pair.types.slice(0, 3).join(", "));
      lines.push(`  ${pair.source} -.->|"${label}"| ${pair.target}`);
    }
  }

  // Styling
  if (focusNode) {
    lines.push(`  style ${focusNode.id} fill:#6366f1,stroke:#4f46e5,color:#fff,stroke-width:2px`);
  }
  for (const node of graph.nodes) {
    if (!involvedIds.has(node.id)) continue;
    if (node.role === "direct") {
      lines.push(`  style ${node.id} fill:#e0e7ff,stroke:#6366f1,color:#312e81`);
    }
  }

  return lines.join("\n");
}

export function toMermaidL3(graph: DependencyGraph, direction: MermaidDirection = "TB"): string {
  if (graph.modules.length === 0) return `graph ${direction}\n  empty[No module data]`;

  const lines: string[] = [`graph ${direction}`];

  // Find the focus module
  const focusNode = graph.nodes.find((n) => n.role === "focus");
  const focusModule = focusNode ? getModule(focusNode.filePath) : null;

  for (const mod of graph.modules) {
    const label = `${sanitizeLabel(mod.label)}<br/>(${mod.fileCount} files)`;
    const shape = mod.dirPath === focusModule
      ? `[["${label}"]]`
      : `["${label}"]`;
    lines.push(`  ${mod.id}${shape}`);
  }

  for (const edge of graph.moduleEdges) {
    const label = `${edge.weight} deps`;
    lines.push(`  ${edge.source} ==>|"${label}"| ${edge.target}`);
  }

  // Style focus module
  for (const mod of graph.modules) {
    if (mod.dirPath === focusModule) {
      lines.push(`  style ${mod.id} fill:#6366f1,stroke:#4f46e5,color:#fff,stroke-width:2px`);
    }
  }

  return lines.join("\n");
}
