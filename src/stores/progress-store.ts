/**
 * 学习进度状态（Phase 5.2）
 * 
 * 管理：已探索模块、学习时间、进度百分比、视图模式
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';

enableMapSet();

interface ProgressState {
  // ─── 探索追踪 ───
  exploredModules: Set<string>;
  totalFiles: number;
  totalModules: number;

  // ─── 时间追踪 ───
  sessionStartTime: number;
  totalDwellMs: number;

  // ─── 模式 ───
  viewMode: 'guided' | 'expert';
}

interface ProgressActions {
  // ─── 探索 ───
  markModuleExplored: (module: string) => void;
  setTotals: (files: number, modules: number) => void;

  // ─── 时间 ───
  addDwellTime: (ms: number) => void;
  startSession: () => void;

  // ─── 模式 ───
  setViewMode: (mode: 'guided' | 'expert') => void;
  toggleViewMode: () => void;

  // ─── 计算 ───
  getModuleProgress: () => number;
  getSessionDuration: () => number;

  // ─── 重置 ───
  resetProgress: () => void;
}

export type ProgressStore = ProgressState & ProgressActions;

export const useProgressStore = create<ProgressStore>()(
  immer((set, get) => ({
    // ─── Initial State ───
    exploredModules: new Set(),
    totalFiles: 0,
    totalModules: 0,
    sessionStartTime: Date.now(),
    totalDwellMs: 0,
    viewMode: 'guided',

    // ─── Actions ───
    markModuleExplored: (module) => set((state) => {
      state.exploredModules.add(module);
    }),

    setTotals: (files, modules) => set((state) => {
      state.totalFiles = files;
      state.totalModules = modules;
    }),

    addDwellTime: (ms) => set((state) => {
      state.totalDwellMs += ms;
    }),

    startSession: () => set((state) => {
      state.sessionStartTime = Date.now();
    }),

    setViewMode: (mode) => set((state) => {
      state.viewMode = mode;
    }),

    toggleViewMode: () => set((state) => {
      state.viewMode = state.viewMode === 'guided' ? 'expert' : 'guided';
    }),

    getModuleProgress: () => {
      const { exploredModules, totalModules } = get();
      if (totalModules === 0) return 0;
      return Math.min(100, Math.round((exploredModules.size / totalModules) * 100));
    },

    getSessionDuration: () => {
      return Date.now() - get().sessionStartTime;
    },

    resetProgress: () => set((state) => {
      state.exploredModules = new Set();
      state.totalDwellMs = 0;
      state.sessionStartTime = Date.now();
    }),
  }))
);
