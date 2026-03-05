/**
 * 分析结果类型定义
 * 符号索引、文件摘要、区域标注、热路径等
 */

export interface SymbolInfo {
  name: string;
  kind: 'function' | 'class' | 'type' | 'interface' | 'constant' | 'variable' | 'method' | 'enum';
  line: number;
  endLine?: number;
  exported: boolean;
  signature?: string;
  comment?: string;
  referenceCount?: number;
  isHotPath?: boolean;
}

export interface ImportInfo {
  path: string;
  alias: string | null;
  resolved?: string;
}

export interface ExportInfo {
  name: string;
  kind: string;
  line: number;
}

export interface NavigationEntry {
  file: string;
  line: number;
  symbol?: string;
  timestamp: number;
}

export interface HotPathFile {
  path: string;
  score: number;
  rank: number;
  inDegree: number;
  outDegree: number;
  reason: string;
  cognitivePrereqs: string[];
}

export interface FileSummary {
  path: string;
  role: string;
  tags: string[];
  stats: {
    exports: number;
    imports: number;
    referencedBy: number;
    references: number;
    lines: number;
  };
  aiInsight?: string;
}

export interface RegionAnnotation {
  startLine: number;
  endLine: number;
  type: 'core-logic' | 'interface' | 'export-entry' | 'config' | 'error-handling';
  color: string;
  label: string;
  aiExplanation?: string;
}

export interface PendingCodeSnippet {
  file: string;
  startLine: number;
  endLine: number;
  text: string;
  suggestedPrompt?: string;
}
