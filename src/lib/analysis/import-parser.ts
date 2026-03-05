/**
 * 多语言 Import 解析器
 * 从文件内容中提取 import/依赖路径
 * 支持: Go, JS/TS, Python, Rust, Java, C/C++
 */

export interface ImportEntry {
  /** 原始 import 路径 */
  raw: string;
  /** 解析后的相对路径（尽力推断） */
  resolved: string | null;
  /** import 类型 */
  kind: "module" | "relative" | "stdlib" | "external";
  /** 导入的符号（如有） */
  symbols: string[];
}

export function detectLanguage(filePath: string): string | null {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    go: "go",
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    mjs: "javascript",
    cjs: "javascript",
    py: "python",
    rs: "rust",
    java: "java",
    c: "c",
    h: "c",
    cpp: "cpp",
    cc: "cpp",
    cxx: "cpp",
    hpp: "cpp",
    rb: "ruby",
    swift: "swift",
    kt: "kotlin",
    scala: "scala",
  };
  return map[ext] || null;
}

export function parseImports(
  content: string,
  filePath: string
): ImportEntry[] {
  const lang = detectLanguage(filePath);
  if (!lang) return [];

  switch (lang) {
    case "go":
      return parseGoImports(content);
    case "javascript":
    case "typescript":
      return parseJsTsImports(content);
    case "python":
      return parsePythonImports(content);
    case "rust":
      return parseRustImports(content);
    case "java":
      return parseJavaImports(content);
    case "c":
    case "cpp":
      return parseCImports(content);
    case "ruby":
      return parseRubyImports(content);
    case "kotlin":
    case "scala":
      return parseKotlinScalaImports(content);
    case "swift":
      return parseSwiftImports(content);
    default:
      return [];
  }
}

// ─── Go ──────────────────────────────────────────────
function parseGoImports(content: string): ImportEntry[] {
  const results: ImportEntry[] = [];

  // Single import: import "fmt"
  const singleRe = /^\s*import\s+"([^"]+)"/gm;
  let m: RegExpExecArray | null;
  while ((m = singleRe.exec(content)) !== null) {
    results.push(goImportEntry(m[1]));
  }

  // Block import: import ( "fmt" \n "os" )
  const blockRe = /import\s*\(([\s\S]*?)\)/g;
  while ((m = blockRe.exec(content)) !== null) {
    const block = m[1];
    const lineRe = /^\s*(?:\w+\s+)?"([^"]+)"/gm;
    let lm: RegExpExecArray | null;
    while ((lm = lineRe.exec(block)) !== null) {
      results.push(goImportEntry(lm[1]));
    }
  }

  return results;
}

function goImportEntry(path: string): ImportEntry {
  // Go stdlib has no dots in first segment; external packages have domains
  const isStdlib = !path.includes(".");
  const isRelative = path.startsWith("./") || path.startsWith("../");
  return {
    raw: path,
    resolved: null, // Go imports are module paths, resolved by graph builder
    kind: isRelative ? "relative" : isStdlib ? "stdlib" : "external",
    symbols: [],
  };
}

// ─── JavaScript / TypeScript ────────────────────────
function parseJsTsImports(content: string): ImportEntry[] {
  const results: ImportEntry[] = [];

  // ES import: import X from 'path', import { X } from 'path', import 'path'
  const esRe =
    /import\s+(?:(?:(\{[^}]*\})|(\*\s+as\s+\w+)|(\w+))(?:\s*,\s*(?:(\{[^}]*\})|(\*\s+as\s+\w+)|(\w+)))*\s+from\s+)?['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = esRe.exec(content)) !== null) {
    const path = m[7];
    const symbols = extractNamedImports(m[1] || m[4] || "");
    results.push(jsTsImportEntry(path, symbols));
  }

  // require(): const X = require('path')
  const reqRe = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = reqRe.exec(content)) !== null) {
    results.push(jsTsImportEntry(m[1], []));
  }

  // Dynamic import: import('path')
  const dynRe = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = dynRe.exec(content)) !== null) {
    results.push(jsTsImportEntry(m[1], []));
  }

  // Re-export: export { X } from 'path'
  const reExportRe = /export\s+(?:(\{[^}]*\})|(\*))\s+from\s+['"]([^'"]+)['"]/g;
  while ((m = reExportRe.exec(content)) !== null) {
    const symbols = extractNamedImports(m[1] || "");
    results.push(jsTsImportEntry(m[3], symbols));
  }

  return results;
}

function extractNamedImports(braceContent: string): string[] {
  if (!braceContent) return [];
  return braceContent
    .replace(/[{}]/g, "")
    .split(",")
    .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
    .filter(Boolean);
}

function jsTsImportEntry(path: string, symbols: string[]): ImportEntry {
  const isRelative = path.startsWith(".") || path.startsWith("/");
  const isBuiltin = ["fs", "path", "os", "http", "https", "url", "util", "stream", "events", "child_process", "crypto", "net", "tls", "dns", "cluster", "readline", "zlib", "buffer", "assert", "querystring", "string_decoder", "timers", "tty", "v8", "vm", "worker_threads"].includes(path);
  return {
    raw: path,
    resolved: isRelative ? path : null,
    kind: isRelative ? "relative" : isBuiltin ? "stdlib" : "external",
    symbols,
  };
}

// ─── Python ─────────────────────────────────────────
function parsePythonImports(content: string): ImportEntry[] {
  const results: ImportEntry[] = [];

  // import module / import module as alias
  const importRe = /^\s*import\s+([\w.]+)/gm;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(content)) !== null) {
    results.push(pythonImportEntry(m[1], []));
  }

  // from module import X, Y
  const fromRe = /^\s*from\s+([\w.]+)\s+import\s+(.+)/gm;
  while ((m = fromRe.exec(content)) !== null) {
    const symbols = m[2]
      .split(",")
      .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
      .filter((s) => s && s !== "*");
    results.push(pythonImportEntry(m[1], symbols));
  }

  return results;
}

function pythonImportEntry(module: string, symbols: string[]): ImportEntry {
  const isRelative = module.startsWith(".");
  return {
    raw: module,
    resolved: isRelative ? module.replace(/\./g, "/") : null,
    kind: isRelative ? "relative" : "module",
    symbols,
  };
}

// ─── Rust ───────────────────────────────────────────
function parseRustImports(content: string): ImportEntry[] {
  const results: ImportEntry[] = [];

  // use std::collections::HashMap;
  // use crate::module::name;
  // use super::something;
  const useRe = /^\s*use\s+([\w:]+(?:::\{[^}]+\})?)\s*;/gm;
  let m: RegExpExecArray | null;
  while ((m = useRe.exec(content)) !== null) {
    const path = m[1];
    const isCrate = path.startsWith("crate::") || path.startsWith("super::");
    const isStd = path.startsWith("std::") || path.startsWith("core::") || path.startsWith("alloc::");
    results.push({
      raw: path,
      resolved: isCrate ? path.replace(/::/g, "/") : null,
      kind: isCrate ? "relative" : isStd ? "stdlib" : "external",
      symbols: extractRustSymbols(path),
    });
  }

  // mod declarations
  const modRe = /^\s*mod\s+(\w+)\s*;/gm;
  while ((m = modRe.exec(content)) !== null) {
    results.push({
      raw: m[1],
      resolved: m[1],
      kind: "relative",
      symbols: [],
    });
  }

  return results;
}

function extractRustSymbols(path: string): string[] {
  const braceMatch = path.match(/\{([^}]+)\}/);
  if (!braceMatch) {
    const parts = path.split("::");
    return [parts[parts.length - 1]];
  }
  return braceMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
}

// ─── Java ───────────────────────────────────────────
function parseJavaImports(content: string): ImportEntry[] {
  const results: ImportEntry[] = [];

  const importRe = /^\s*import\s+(?:static\s+)?([\w.]+(?:\.\*)?)\s*;/gm;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(content)) !== null) {
    const path = m[1];
    const isJava = path.startsWith("java.") || path.startsWith("javax.");
    results.push({
      raw: path,
      resolved: path.replace(/\./g, "/"),
      kind: isJava ? "stdlib" : "external",
      symbols: [path.split(".").pop() || ""],
    });
  }

  return results;
}

// ─── C / C++ ────────────────────────────────────────
function parseCImports(content: string): ImportEntry[] {
  const results: ImportEntry[] = [];

  // #include <header>  or  #include "header"
  const includeRe = /^\s*#\s*include\s+([<"])([^>"]+)[>"]/gm;
  let m: RegExpExecArray | null;
  while ((m = includeRe.exec(content)) !== null) {
    const isSystem = m[1] === "<";
    results.push({
      raw: m[2],
      resolved: isSystem ? null : m[2],
      kind: isSystem ? "stdlib" : "relative",
      symbols: [],
    });
  }

  return results;
}

// ─── Ruby ───────────────────────────────────────────
function parseRubyImports(content: string): ImportEntry[] {
  const results: ImportEntry[] = [];

  const requireRe = /^\s*require(?:_relative)?\s+['"]([^'"]+)['"]/gm;
  let m: RegExpExecArray | null;
  while ((m = requireRe.exec(content)) !== null) {
    const isRelative = m[0].includes("require_relative");
    results.push({
      raw: m[1],
      resolved: isRelative ? m[1] : null,
      kind: isRelative ? "relative" : "module",
      symbols: [],
    });
  }

  return results;
}

// ─── Kotlin / Scala ─────────────────────────────────
function parseKotlinScalaImports(content: string): ImportEntry[] {
  const results: ImportEntry[] = [];

  const importRe = /^\s*import\s+([\w.]+(?:\.\*)?)/gm;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(content)) !== null) {
    const path = m[1];
    const isStd =
      path.startsWith("kotlin.") ||
      path.startsWith("java.") ||
      path.startsWith("scala.");
    results.push({
      raw: path,
      resolved: path.replace(/\./g, "/"),
      kind: isStd ? "stdlib" : "external",
      symbols: [path.split(".").pop() || ""],
    });
  }

  return results;
}

// ─── Swift ──────────────────────────────────────────
function parseSwiftImports(content: string): ImportEntry[] {
  const results: ImportEntry[] = [];

  const importRe = /^\s*import\s+(?:class\s+|struct\s+|enum\s+|protocol\s+|func\s+)?(\w+)/gm;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(content)) !== null) {
    const mod = m[1];
    const isStd = ["Foundation", "UIKit", "SwiftUI", "Combine", "Darwin", "Swift"].includes(mod);
    results.push({
      raw: mod,
      resolved: null,
      kind: isStd ? "stdlib" : "external",
      symbols: [],
    });
  }

  return results;
}
