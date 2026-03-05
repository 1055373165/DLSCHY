/**
 * 工作区核心状态 — 三面板联动基础（Decision 7）
 * 
 * 管理：activeFile, tree, repoData, layout, highlights, selectedCode
 * 所有面板读写此 store，联动延迟 <100ms
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import type { FileStatus, CodeSelection, PendingNavigation, RepoData, TreeNode } from '@/types/workspace';

enableMapSet();

interface WorkspaceState {
  // ─── 项目信息 ───
  owner: string;
  repo: string;
  repoData: RepoData | null;
  tree: TreeNode[];
  loading: boolean;
  error: string | null;

  // ─── 三面板联动 ───
  activeFile: string | null;
  activeFileContent: string | null;
  highlightedFiles: Record<string, FileStatus>;
  scrollToLine: number | null;
  aiContextFile: string | null;
  selectedCode: CodeSelection | null;
  pendingNavigation: PendingNavigation | null;
  exploredFiles: Set<string>;

  // ─── 面板布局 ───
  sidebarOpen: boolean;
  centerView: 'code' | 'graph';
  sidebarWidth: number;
  chatPanelWidth: number;
}

interface WorkspaceActions {
  // ─── 初始化 ───
  setProject: (owner: string, repo: string) => void;
  setRepoData: (data: RepoData) => void;
  setTree: (tree: TreeNode[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // ─── 导航（三面板联动核心） ───
  navigateToFile: (file: string, line?: number, source?: PendingNavigation['source']) => void;
  setActiveFileContent: (content: string | null) => void;
  setScrollToLine: (line: number | null) => void;
  clearPendingNavigation: () => void;

  // ─── 代码选中 ───
  selectCode: (selection: CodeSelection | null) => void;

  // ─── 文件状态 ───
  highlightFiles: (files: Record<string, FileStatus>) => void;
  aiMentionsFiles: (files: string[]) => void;
  setHotPathHighlights: (files: string[]) => void;
  markExplored: (file: string) => void;
  getFileStatus: (path: string) => FileStatus | 'explored' | null;

  // ─── 布局 ───
  toggleSidebar: () => void;
  setCenterView: (view: 'code' | 'graph') => void;
  setSidebarWidth: (width: number) => void;
  setChatPanelWidth: (width: number) => void;
}

export type WorkspaceStore = WorkspaceState & WorkspaceActions;

export const useWorkspaceStore = create<WorkspaceStore>()(
  immer((set, get) => ({
    // ─── Initial State ───
    owner: '',
    repo: '',
    repoData: null,
    tree: [],
    loading: true,
    error: null,
    activeFile: null,
    activeFileContent: null,
    highlightedFiles: {},
    scrollToLine: null,
    aiContextFile: null,
    selectedCode: null,
    pendingNavigation: null,
    exploredFiles: new Set(),
    sidebarOpen: true,
    centerView: 'code',
    sidebarWidth: 256,
    chatPanelWidth: 440,

    // ─── Actions ───
    setProject: (owner, repo) => set((state) => {
      state.owner = owner;
      state.repo = repo;
    }),

    setRepoData: (data) => set((state) => {
      state.repoData = data;
    }),

    setTree: (tree) => set((state) => {
      state.tree = tree;
    }),

    setLoading: (loading) => set((state) => {
      state.loading = loading;
    }),

    setError: (error) => set((state) => {
      state.error = error;
    }),

    navigateToFile: (file, line, source = 'tree') => set((state) => {
      state.activeFile = file;
      state.activeFileContent = null;
      state.scrollToLine = line ?? null;
      state.aiContextFile = file;
      state.selectedCode = null;
      state.exploredFiles.add(file);
      state.pendingNavigation = { file, line, source };

      // Keep hot-path highlights, clear ai-mentioned
      const newHighlights: Record<string, FileStatus> = {};
      for (const [f, s] of Object.entries(state.highlightedFiles)) {
        if (s === 'hot-path') newHighlights[f] = s;
      }
      state.highlightedFiles = newHighlights;
    }),

    setActiveFileContent: (content) => set((state) => {
      state.activeFileContent = content;
    }),

    setScrollToLine: (line) => set((state) => {
      state.scrollToLine = line;
    }),

    clearPendingNavigation: () => set((state) => {
      state.pendingNavigation = null;
    }),

    selectCode: (selection) => set((state) => {
      state.selectedCode = selection;
    }),

    highlightFiles: (files) => set((state) => {
      for (const [f, s] of Object.entries(files)) {
        if (state.highlightedFiles[f] === 'hot-path' && s !== 'hot-path') continue;
        state.highlightedFiles[f] = s;
      }
    }),

    aiMentionsFiles: (files) => set((state) => {
      for (const f of files) {
        if (state.highlightedFiles[f] !== 'hot-path') {
          state.highlightedFiles[f] = 'ai-mentioned';
        }
      }
    }),

    setHotPathHighlights: (files) => set((state) => {
      for (const f of files) {
        state.highlightedFiles[f] = 'hot-path';
      }
    }),

    markExplored: (file) => set((state) => {
      state.exploredFiles.add(file);
    }),

    getFileStatus: (path) => {
      const state = get();
      if (state.highlightedFiles[path]) return state.highlightedFiles[path];
      if (state.exploredFiles.has(path)) return 'explored';
      return null;
    },

    toggleSidebar: () => set((state) => {
      state.sidebarOpen = !state.sidebarOpen;
    }),

    setCenterView: (view) => set((state) => {
      state.centerView = view;
    }),

    setSidebarWidth: (width) => set((state) => {
      state.sidebarWidth = width;
    }),

    setChatPanelWidth: (width) => set((state) => {
      state.chatPanelWidth = width;
    }),
  }))
);
