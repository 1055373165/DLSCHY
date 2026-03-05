/**
 * 热路径进度状态（Decision 8）
 * 
 * 管理：热路径文件列表、学习进度、停留时间追踪、完成标记
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import type { HotPathFile } from '@/types/analysis';

enableMapSet();

interface HotPathState {
  files: HotPathFile[];
  entryPoint: string | null;
  structureSummary: string | null;
  ready: boolean;

  currentStep: number;
  completed: Set<string>;
  dwellTimers: Map<string, number>;
}

interface HotPathActions {
  setHotPath: (files: HotPathFile[], entryPoint: string, summary: string | null) => void;
  markCompleted: (filePath: string) => void;
  setCurrentStep: (step: number) => void;
  updateDwellTime: (filePath: string, seconds: number) => void;
  reset: () => void;

  getProgress: () => { current: number; total: number };
  getNextFile: () => string | null;
  isAllComplete: () => boolean;
  getRankForFile: (filePath: string) => number | null;
}

export type HotPathStore = HotPathState & HotPathActions;

export const useHotPathStore = create<HotPathStore>()(
  immer((set, get) => ({
    files: [],
    entryPoint: null,
    structureSummary: null,
    ready: false,
    currentStep: 0,
    completed: new Set(),
    dwellTimers: new Map(),

    setHotPath: (files, entryPoint, summary) => set((state) => {
      state.files = files;
      state.entryPoint = entryPoint;
      state.structureSummary = summary;
      state.ready = true;
      state.currentStep = 0;
      state.completed = new Set();
    }),

    markCompleted: (filePath) => set((state) => {
      state.completed.add(filePath);
      // Auto-advance currentStep
      const idx = state.files.findIndex((f) => f.path === filePath);
      if (idx >= 0 && idx === state.currentStep) {
        state.currentStep = Math.min(state.currentStep + 1, state.files.length - 1);
      }
    }),

    setCurrentStep: (step) => set((state) => {
      state.currentStep = step;
    }),

    updateDwellTime: (filePath, seconds) => set((state) => {
      const current = state.dwellTimers.get(filePath) || 0;
      state.dwellTimers.set(filePath, current + seconds);
      // Auto-complete after 30s dwell (Decision 8)
      if (current + seconds >= 30 && !state.completed.has(filePath)) {
        state.completed.add(filePath);
      }
    }),

    reset: () => set((state) => {
      state.files = [];
      state.entryPoint = null;
      state.structureSummary = null;
      state.ready = false;
      state.currentStep = 0;
      state.completed = new Set();
      state.dwellTimers = new Map();
    }),

    getProgress: () => {
      const { files, completed } = get();
      return { current: completed.size, total: files.length };
    },

    getNextFile: () => {
      const { files, completed } = get();
      const next = files.find((f) => !completed.has(f.path));
      return next?.path ?? null;
    },

    isAllComplete: () => {
      const { files, completed } = get();
      return files.length > 0 && completed.size >= files.length;
    },

    getRankForFile: (filePath) => {
      const { files } = get();
      const file = files.find((f) => f.path === filePath);
      return file?.rank ?? null;
    },
  }))
);
