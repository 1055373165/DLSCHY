/**
 * IDE 导航状态（Decision 9a）
 * 
 * 管理：符号索引、跳转历史栈、符号大纲可见性
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import type { SymbolInfo, NavigationEntry } from '@/types/analysis';

enableMapSet();

interface NavigationState {
  symbolIndex: Map<string, SymbolInfo[]>;
  symbolLoading: Set<string>;
  navigationStack: NavigationEntry[];
  stackCursor: number;
  outlineVisible: boolean;
  outlineWidth: number;
}

interface NavigationActions {
  setSymbols: (filePath: string, symbols: SymbolInfo[]) => void;
  setSymbolLoading: (filePath: string, loading: boolean) => void;
  getSymbols: (filePath: string) => SymbolInfo[] | null;

  pushNavigation: (entry: Omit<NavigationEntry, 'timestamp'>) => void;
  goBack: () => NavigationEntry | null;
  goForward: () => NavigationEntry | null;
  canGoBack: () => boolean;
  canGoForward: () => boolean;

  toggleOutline: () => void;
  setOutlineWidth: (width: number) => void;

  reset: () => void;
}

export type NavigationStore = NavigationState & NavigationActions;

export const useNavigationStore = create<NavigationStore>()(
  immer((set, get) => ({
    symbolIndex: new Map(),
    symbolLoading: new Set(),
    navigationStack: [],
    stackCursor: -1,
    outlineVisible: false,
    outlineWidth: 200,

    setSymbols: (filePath, symbols) => set((state) => {
      state.symbolIndex.set(filePath, symbols);
      state.symbolLoading.delete(filePath);
    }),

    setSymbolLoading: (filePath, loading) => set((state) => {
      if (loading) {
        state.symbolLoading.add(filePath);
      } else {
        state.symbolLoading.delete(filePath);
      }
    }),

    getSymbols: (filePath) => {
      return get().symbolIndex.get(filePath) ?? null;
    },

    pushNavigation: (entry) => set((state) => {
      const fullEntry: NavigationEntry = { ...entry, timestamp: Date.now() };
      // Truncate forward history when pushing new entry
      state.navigationStack = state.navigationStack.slice(0, state.stackCursor + 1);
      state.navigationStack.push(fullEntry);
      state.stackCursor = state.navigationStack.length - 1;
    }),

    goBack: () => {
      const { navigationStack, stackCursor } = get();
      if (stackCursor <= 0) return null;
      const newCursor = stackCursor - 1;
      set((state) => { state.stackCursor = newCursor; });
      return navigationStack[newCursor];
    },

    goForward: () => {
      const { navigationStack, stackCursor } = get();
      if (stackCursor >= navigationStack.length - 1) return null;
      const newCursor = stackCursor + 1;
      set((state) => { state.stackCursor = newCursor; });
      return navigationStack[newCursor];
    },

    canGoBack: () => get().stackCursor > 0,
    canGoForward: () => {
      const { navigationStack, stackCursor } = get();
      return stackCursor < navigationStack.length - 1;
    },

    toggleOutline: () => set((state) => {
      state.outlineVisible = !state.outlineVisible;
    }),

    setOutlineWidth: (width) => set((state) => {
      state.outlineWidth = width;
    }),

    reset: () => set((state) => {
      state.symbolIndex = new Map();
      state.symbolLoading = new Set();
      state.navigationStack = [];
      state.stackCursor = -1;
    }),
  }))
);
