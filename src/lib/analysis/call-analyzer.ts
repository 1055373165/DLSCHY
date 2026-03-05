/**
 * L2: Call Chain 分析器
 * 从文件内容中提取函数/类型导出和调用关系
 * 用于构建跨文件的函数级调用链
 */

import { detectLanguage } from "./import-parser";

export interface ExportedSymbol {
  name: string;
  kind: "function" | "class" | "type" | "variable" | "interface" | "struct" | "method";
  line?: number;
}

export interface FunctionCall {
  /** 被调用的符号名 */
  name: string;
  /** 来源 import 路径（如果能推断） */
  fromImport: string | null;
  /** 调用所在行（近似） */
  line?: number;
}

export interface FileAnalysis {
  exports: ExportedSymbol[];
  calls: FunctionCall[];
}

export function analyzeFile(
  content: string,
  filePath: string
): FileAnalysis {
  const lang = detectLanguage(filePath);
  if (!lang) return { exports: [], calls: [] };

  switch (lang) {
    case "go":
      return analyzeGo(content);
    case "javascript":
    case "typescript":
      return analyzeJsTs(content);
    case "python":
      return analyzePython(content);
    case "rust":
      return analyzeRust(content);
    case "java":
      return analyzeJava(content);
    case "c":
    case "cpp":
      return analyzeC(content);
    default:
      return { exports: [], calls: [] };
  }
}

// ─── Go ──────────────────────────────────────────────
function analyzeGo(content: string): FileAnalysis {
  const exports: ExportedSymbol[] = [];
  const calls: FunctionCall[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Exported functions: func FuncName( — uppercase first letter = exported
    const funcMatch = line.match(/^func\s+(?:\(\s*\w+\s+\*?\w+\s*\)\s+)?([A-Z]\w*)\s*\(/);
    if (funcMatch) {
      exports.push({ name: funcMatch[1], kind: "function", line: i + 1 });
    }

    // Exported types: type TypeName struct/interface
    const typeMatch = line.match(/^type\s+([A-Z]\w*)\s+(struct|interface)/);
    if (typeMatch) {
      exports.push({
        name: typeMatch[1],
        kind: typeMatch[2] === "interface" ? "interface" : "struct",
        line: i + 1,
      });
    }

    // Function calls: package.FuncName( or FuncName(
    const callRe = /(?:(\w+)\.)?([A-Z]\w*)\s*\(/g;
    let cm: RegExpExecArray | null;
    while ((cm = callRe.exec(line)) !== null) {
      // Skip if it's the function definition itself
      if (line.trimStart().startsWith("func ")) continue;
      calls.push({
        name: cm[1] ? `${cm[1]}.${cm[2]}` : cm[2],
        fromImport: cm[1] || null,
        line: i + 1,
      });
    }
  }

  return { exports, calls };
}

// ─── JavaScript / TypeScript ────────────────────────
function analyzeJsTs(content: string): FileAnalysis {
  const exports: ExportedSymbol[] = [];
  const calls: FunctionCall[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // export function/class/const/type/interface
    const exportFuncMatch = line.match(
      /export\s+(?:default\s+)?(?:async\s+)?function\s+(\w+)/
    );
    if (exportFuncMatch) {
      exports.push({ name: exportFuncMatch[1], kind: "function", line: i + 1 });
    }

    const exportClassMatch = line.match(/export\s+(?:default\s+)?class\s+(\w+)/);
    if (exportClassMatch) {
      exports.push({ name: exportClassMatch[1], kind: "class", line: i + 1 });
    }

    const exportConstMatch = line.match(
      /export\s+(?:const|let|var)\s+(\w+)/
    );
    if (exportConstMatch) {
      exports.push({ name: exportConstMatch[1], kind: "variable", line: i + 1 });
    }

    const exportTypeMatch = line.match(
      /export\s+(?:type|interface)\s+(\w+)/
    );
    if (exportTypeMatch) {
      exports.push({
        name: exportTypeMatch[1],
        kind: line.includes("interface") ? "interface" : "type",
        line: i + 1,
      });
    }

    // Function calls: identifier( — skip keywords and declarations
    if (
      !line.trimStart().startsWith("import ") &&
      !line.trimStart().startsWith("export ") &&
      !line.trimStart().startsWith("//") &&
      !line.trimStart().startsWith("*")
    ) {
      const callRe = /(?:(?:await\s+)?(\w+)\.)?(\w+)\s*\(/g;
      let cm: RegExpExecArray | null;
      while ((cm = callRe.exec(line)) !== null) {
        const name = cm[2];
        // Skip keywords
        if (
          [
            "if", "for", "while", "switch", "catch", "function", "class",
            "return", "new", "typeof", "instanceof", "import", "require",
          ].includes(name)
        ) {
          continue;
        }
        calls.push({
          name: cm[1] ? `${cm[1]}.${name}` : name,
          fromImport: cm[1] || null,
          line: i + 1,
        });
      }
    }
  }

  return { exports, calls };
}

// ─── Python ─────────────────────────────────────────
function analyzePython(content: string): FileAnalysis {
  const exports: ExportedSymbol[] = [];
  const calls: FunctionCall[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Top-level function/class (no leading whitespace)
    const defMatch = line.match(/^def\s+(\w+)\s*\(/);
    if (defMatch && !defMatch[1].startsWith("_")) {
      exports.push({ name: defMatch[1], kind: "function", line: i + 1 });
    }

    const classMatch = line.match(/^class\s+(\w+)/);
    if (classMatch) {
      exports.push({ name: classMatch[1], kind: "class", line: i + 1 });
    }

    // Function calls
    if (!line.trimStart().startsWith("#") && !line.trimStart().startsWith("import ") && !line.trimStart().startsWith("from ")) {
      const callRe = /(?:(\w+)\.)?(\w+)\s*\(/g;
      let cm: RegExpExecArray | null;
      while ((cm = callRe.exec(line)) !== null) {
        const name = cm[2];
        if (["def", "class", "if", "for", "while", "with", "print", "return", "lambda"].includes(name)) continue;
        calls.push({
          name: cm[1] ? `${cm[1]}.${name}` : name,
          fromImport: cm[1] || null,
          line: i + 1,
        });
      }
    }
  }

  return { exports, calls };
}

// ─── Rust ───────────────────────────────────────────
function analyzeRust(content: string): FileAnalysis {
  const exports: ExportedSymbol[] = [];
  const calls: FunctionCall[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // pub fn, pub struct, pub trait, pub enum
    const pubFnMatch = line.match(/pub\s+(?:async\s+)?fn\s+(\w+)/);
    if (pubFnMatch) {
      exports.push({ name: pubFnMatch[1], kind: "function", line: i + 1 });
    }

    const pubStructMatch = line.match(/pub\s+(?:struct|enum)\s+(\w+)/);
    if (pubStructMatch) {
      exports.push({ name: pubStructMatch[1], kind: "struct", line: i + 1 });
    }

    const pubTraitMatch = line.match(/pub\s+trait\s+(\w+)/);
    if (pubTraitMatch) {
      exports.push({ name: pubTraitMatch[1], kind: "interface", line: i + 1 });
    }

    // Function calls
    if (!line.trimStart().startsWith("//") && !line.trimStart().startsWith("use ")) {
      const callRe = /(\w+)(?:::(\w+))*\s*\(/g;
      let cm: RegExpExecArray | null;
      while ((cm = callRe.exec(line)) !== null) {
        const full = cm[0].replace(/\s*\($/, "");
        if (["fn", "if", "for", "while", "match", "pub", "let", "mut"].includes(cm[1])) continue;
        calls.push({
          name: full,
          fromImport: full.includes("::") ? full.split("::")[0] : null,
          line: i + 1,
        });
      }
    }
  }

  return { exports, calls };
}

// ─── Java ───────────────────────────────────────────
function analyzeJava(content: string): FileAnalysis {
  const exports: ExportedSymbol[] = [];
  const calls: FunctionCall[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // public class/interface/method
    const classMatch = line.match(/public\s+(?:abstract\s+)?(?:class|interface|enum)\s+(\w+)/);
    if (classMatch) {
      exports.push({
        name: classMatch[1],
        kind: line.includes("interface") ? "interface" : "class",
        line: i + 1,
      });
    }

    const methodMatch = line.match(
      /public\s+(?:static\s+)?(?:abstract\s+)?(?:synchronized\s+)?(?:\w+(?:<[^>]+>)?)\s+(\w+)\s*\(/
    );
    if (methodMatch && !["class", "interface", "enum"].includes(methodMatch[1])) {
      exports.push({ name: methodMatch[1], kind: "method", line: i + 1 });
    }

    // Method calls: obj.method( or ClassName.staticMethod(
    if (!line.trimStart().startsWith("//") && !line.trimStart().startsWith("*") && !line.trimStart().startsWith("import ")) {
      const callRe = /(\w+)\.(\w+)\s*\(/g;
      let cm: RegExpExecArray | null;
      while ((cm = callRe.exec(line)) !== null) {
        calls.push({
          name: `${cm[1]}.${cm[2]}`,
          fromImport: cm[1],
          line: i + 1,
        });
      }
    }
  }

  return { exports, calls };
}

// ─── C / C++ ────────────────────────────────────────
function analyzeC(content: string): FileAnalysis {
  const exports: ExportedSymbol[] = [];
  const calls: FunctionCall[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Function definitions at top level (simplified)
    const funcMatch = line.match(
      /^(?:static\s+)?(?:extern\s+)?(?:inline\s+)?(?:const\s+)?(?:\w+[\s*]+)(\w+)\s*\([^)]*\)\s*\{?\s*$/
    );
    if (funcMatch && !["if", "for", "while", "switch", "return"].includes(funcMatch[1])) {
      exports.push({ name: funcMatch[1], kind: "function", line: i + 1 });
    }

    // struct/typedef
    const structMatch = line.match(/(?:typedef\s+)?struct\s+(\w+)/);
    if (structMatch) {
      exports.push({ name: structMatch[1], kind: "struct", line: i + 1 });
    }

    // Function calls
    if (!line.trimStart().startsWith("//") && !line.trimStart().startsWith("#") && !line.trimStart().startsWith("*")) {
      const callRe = /(\w+)\s*\(/g;
      let cm: RegExpExecArray | null;
      while ((cm = callRe.exec(line)) !== null) {
        if (["if", "for", "while", "switch", "return", "sizeof", "defined", "typedef", "struct"].includes(cm[1])) continue;
        calls.push({
          name: cm[1],
          fromImport: null,
          line: i + 1,
        });
      }
    }
  }

  return { exports, calls };
}
