import { NextRequest, NextResponse } from "next/server";
import {
  getFileContent,
  decodeFileContent,
  GitHubError,
} from "@/lib/github/client";
import { analyzeFile } from "@/lib/analysis/call-analyzer";
import type { SymbolInfo } from "@/types/analysis";

/**
 * GET /api/github/symbols?owner=X&repo=X&path=X
 *
 * Returns symbol index for a file: functions, classes, types, constants, etc.
 * Used by Decision 9a: IDE-level navigation (symbol outline, jump-to-def).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  const filePath = searchParams.get("path");

  if (!owner || !repo || !filePath) {
    return NextResponse.json(
      { error: "Missing required parameters: owner, repo, path" },
      { status: 400 }
    );
  }

  try {
    const fileData = await getFileContent(owner, repo, filePath);
    if (!fileData.content) {
      return NextResponse.json({ symbols: [] });
    }

    const content = decodeFileContent(fileData.content);
    const analysis = analyzeFile(content, filePath);
    const lines = content.split("\n");

    // Build SymbolInfo[] from exports + detect additional patterns
    const symbols: SymbolInfo[] = [];

    // Add exported symbols from call-analyzer
    for (const exp of analysis.exports) {
      const line = exp.line ?? 1;
      // Try to extract signature from the line
      const lineText = lines[line - 1] || "";
      // Try to extract preceding comment
      let comment: string | undefined;
      if (line > 1) {
        const prevLine = lines[line - 2]?.trim() || "";
        if (prevLine.startsWith("//") || prevLine.startsWith("*") || prevLine.startsWith("/**") || prevLine.startsWith("#")) {
          comment = prevLine.replace(/^\/\/\s*|^\/\*\*?\s*|\*\/\s*$|^\*\s*|^#\s*/g, "").trim();
        }
      }

      const kind = mapKind(exp.kind);
      symbols.push({
        name: exp.name,
        kind,
        line,
        exported: true,
        signature: lineText.trim().slice(0, 120),
        comment,
      });
    }

    // Also detect non-exported symbols using regex patterns
    const additionalSymbols = extractLocalSymbols(content, filePath);
    for (const sym of additionalSymbols) {
      // Avoid duplicates
      if (!symbols.some((s) => s.name === sym.name && s.line === sym.line)) {
        symbols.push(sym);
      }
    }

    // Sort by line number
    symbols.sort((a, b) => a.line - b.line);

    return NextResponse.json({ symbols });
  } catch (error) {
    console.error("Symbols API error:", error);
    if (error instanceof GitHubError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to extract symbols" },
      { status: 500 }
    );
  }
}

function mapKind(kind: string): SymbolInfo["kind"] {
  const mapping: Record<string, SymbolInfo["kind"]> = {
    function: "function",
    class: "class",
    type: "type",
    interface: "interface",
    struct: "class",
    variable: "variable",
    method: "method",
  };
  return mapping[kind] ?? "variable";
}

/** Extract local (non-exported) symbols via regex for common languages */
function extractLocalSymbols(content: string, filePath: string): SymbolInfo[] {
  const symbols: SymbolInfo[] = [];
  const lines = content.split("\n");
  const ext = filePath.split(".").pop()?.toLowerCase() || "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (["ts", "tsx", "js", "jsx", "mjs"].includes(ext)) {
      // Local functions: function name( or const name = (...) =>
      const fnMatch = line.match(/^(?:async\s+)?function\s+([a-z_]\w*)\s*\(/i);
      if (fnMatch) {
        symbols.push({ name: fnMatch[1], kind: "function", line: lineNum, exported: false });
        continue;
      }
      const arrowMatch = line.match(/^(?:const|let|var)\s+([a-z_]\w*)\s*=\s*(?:async\s+)?\(/i);
      if (arrowMatch) {
        symbols.push({ name: arrowMatch[1], kind: "function", line: lineNum, exported: false });
        continue;
      }
      // Type/interface
      const typeMatch = line.match(/^(?:type|interface)\s+([A-Z]\w*)/);
      if (typeMatch) {
        symbols.push({ name: typeMatch[1], kind: "type", line: lineNum, exported: false });
        continue;
      }
      // Class
      const classMatch = line.match(/^class\s+(\w+)/);
      if (classMatch) {
        symbols.push({ name: classMatch[1], kind: "class", line: lineNum, exported: false });
        continue;
      }
      // Constants: const UPPER_CASE =
      const constMatch = line.match(/^(?:export\s+)?const\s+([A-Z][A-Z_0-9]+)\s*=/);
      if (constMatch) {
        symbols.push({ name: constMatch[1], kind: "constant", line: lineNum, exported: line.includes("export") });
        continue;
      }
    } else if (["go"].includes(ext)) {
      // Local funcs (lowercase)
      const goFnMatch = line.match(/^func\s+(?:\(\s*\w+\s+\*?\w+\s*\)\s+)?([a-z]\w*)\s*\(/);
      if (goFnMatch) {
        symbols.push({ name: goFnMatch[1], kind: "function", line: lineNum, exported: false });
        continue;
      }
      // Local types
      const goTypeMatch = line.match(/^type\s+([a-z]\w*)\s+(struct|interface)/);
      if (goTypeMatch) {
        symbols.push({ name: goTypeMatch[1], kind: goTypeMatch[2] === "interface" ? "interface" : "class", line: lineNum, exported: false });
        continue;
      }
    } else if (["py"].includes(ext)) {
      // Python def/class
      const pyFnMatch = line.match(/^(?:async\s+)?def\s+(\w+)\s*\(/);
      if (pyFnMatch) {
        symbols.push({ name: pyFnMatch[1], kind: "function", line: lineNum, exported: !pyFnMatch[1].startsWith("_") });
        continue;
      }
      const pyClassMatch = line.match(/^class\s+(\w+)/);
      if (pyClassMatch) {
        symbols.push({ name: pyClassMatch[1], kind: "class", line: lineNum, exported: !pyClassMatch[1].startsWith("_") });
        continue;
      }
    } else if (["rs"].includes(ext)) {
      // Rust fn/struct/enum/trait
      const rsFnMatch = line.match(/^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/);
      if (rsFnMatch) {
        symbols.push({ name: rsFnMatch[1], kind: "function", line: lineNum, exported: line.startsWith("pub") });
        continue;
      }
      const rsTypeMatch = line.match(/^(?:pub\s+)?(?:struct|enum|trait)\s+(\w+)/);
      if (rsTypeMatch) {
        symbols.push({ name: rsTypeMatch[1], kind: "class", line: lineNum, exported: line.startsWith("pub") });
        continue;
      }
    } else if (["java", "kt"].includes(ext)) {
      // Java/Kotlin class/method
      const javaClassMatch = line.match(/^(?:public|private|protected)?\s*(?:static\s+)?(?:abstract\s+)?class\s+(\w+)/);
      if (javaClassMatch) {
        symbols.push({ name: javaClassMatch[1], kind: "class", line: lineNum, exported: true });
        continue;
      }
    }
  }

  return symbols;
}
