/**
 * 工作区相关类型定义
 * 三面板联动、文件树、代码选中等核心类型
 */

export type FileStatus = 'explored' | 'ai-mentioned' | 'hot-path';

export interface CodeSelection {
  file: string;
  startLine: number;
  endLine: number;
  text: string;
}

export interface PendingNavigation {
  file: string;
  line?: number;
  source: 'ai' | 'tree' | 'code' | 'graph' | 'northstar';
}

export interface RepoData {
  name: string;
  fullName: string;
  owner: string;
  description: string | null;
  language: string | null;
  stars: number;
  defaultBranch: string;
}

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: TreeNode[];
}
