/**
 * 北极星图 + 拓扑图状态（Decision 10/11）
 * 
 * 管理：北极星 overlay、图数据、拓扑层级、面包屑
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { ProjectGraph } from '@/types/graph';

interface GraphState {
  // ─── 北极星 overlay（Decision 10）───
  northStarOpen: boolean;
  northStarCenter: string | null;
  graphFilter: 'all' | 'hotpath' | 'module';
  graphData: ProjectGraph | null;
  graphLoading: boolean;

  // ─── 拓扑图（Decision 11）───
  topoLevel: 'L3' | 'L1';
  topoFocusModule: string | null;
  topoBreadcrumb: string[];
}

interface GraphActions {
  // ─── 北极星 ───
  toggleNorthStar: () => void;
  openNorthStar: (centerFile?: string) => void;
  closeNorthStar: () => void;
  setGraphFilter: (filter: 'all' | 'hotpath' | 'module') => void;
  setGraphData: (data: ProjectGraph) => void;
  setGraphLoading: (loading: boolean) => void;
  setNorthStarCenter: (file: string | null) => void;

  // ─── 拓扑图 ───
  drillIntoModule: (moduleId: string) => void;
  drillOut: () => void;
  resetTopo: () => void;
}

export type GraphStore = GraphState & GraphActions;

export const useGraphStore = create<GraphStore>()(
  immer((set) => ({
    // ─── Initial State ───
    northStarOpen: false,
    northStarCenter: null,
    graphFilter: 'all',
    graphData: null,
    graphLoading: false,
    topoLevel: 'L3',
    topoFocusModule: null,
    topoBreadcrumb: ['概览'],

    // ─── North Star Actions ───
    toggleNorthStar: () => set((state) => {
      state.northStarOpen = !state.northStarOpen;
    }),

    openNorthStar: (centerFile) => set((state) => {
      state.northStarOpen = true;
      if (centerFile) state.northStarCenter = centerFile;
    }),

    closeNorthStar: () => set((state) => {
      state.northStarOpen = false;
    }),

    setGraphFilter: (filter) => set((state) => {
      state.graphFilter = filter;
    }),

    setGraphData: (data) => set((state) => {
      state.graphData = data;
      state.graphLoading = false;
    }),

    setGraphLoading: (loading) => set((state) => {
      state.graphLoading = loading;
    }),

    setNorthStarCenter: (file) => set((state) => {
      state.northStarCenter = file;
    }),

    // ─── Topology Actions ───
    drillIntoModule: (moduleId) => set((state) => {
      state.topoLevel = 'L1';
      state.topoFocusModule = moduleId;
      state.topoBreadcrumb.push(moduleId);
    }),

    drillOut: () => set((state) => {
      if (state.topoBreadcrumb.length > 1) {
        state.topoBreadcrumb.pop();
        const last = state.topoBreadcrumb[state.topoBreadcrumb.length - 1];
        if (last === '概览') {
          state.topoLevel = 'L3';
          state.topoFocusModule = null;
        } else {
          state.topoFocusModule = last;
        }
      }
    }),

    resetTopo: () => set((state) => {
      state.topoLevel = 'L3';
      state.topoFocusModule = null;
      state.topoBreadcrumb = ['概览'];
    }),
  }))
);
