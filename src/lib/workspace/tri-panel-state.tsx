"use client";

import { createContext, useContext, useReducer, useCallback, type ReactNode } from "react";

// ─── Types ─────────────────────────────────────────

export type FileStatus = "explored" | "ai-mentioned" | "hot-path";

export interface CodeSelection {
  file: string;
  startLine: number;
  endLine: number;
  text: string;
}

export interface PendingNavigation {
  file: string;
  line?: number;
  source: "ai" | "tree" | "code";
}

export interface TriPanelState {
  /** Currently displayed file in the code viewer */
  activeFile: string | null;
  /** Files highlighted in the file tree (AI-mentioned, import targets, etc.) */
  highlightedFiles: Record<string, FileStatus>;
  /** Line number the code viewer should scroll to */
  scrollToLine: number | null;
  /** File currently injected into AI context */
  aiContextFile: string | null;
  /** User-selected code segment */
  selectedCode: CodeSelection | null;
  /** Pending navigation request from any panel */
  pendingNavigation: PendingNavigation | null;
  /** Set of files the user has visited */
  exploredFiles: Set<string>;
  /** Hot path files identified by analysis */
  hotPathFiles: string[];
  /** Whether hot path analysis is complete */
  hotPathReady: boolean;
  /** Hot path summary from AI */
  hotPathSummary: string | null;
  /** File content cache to avoid redundant fetches */
  activeFileContent: string | null;
}

// ─── Actions ───────────────────────────────────────

type Action =
  | { type: "NAVIGATE_TO_FILE"; file: string; line?: number; source: "ai" | "tree" | "code" }
  | { type: "SET_ACTIVE_FILE_CONTENT"; content: string | null }
  | { type: "SELECT_CODE"; selection: CodeSelection | null }
  | { type: "CLEAR_SELECTION" }
  | { type: "HIGHLIGHT_FILES"; files: Record<string, FileStatus> }
  | { type: "CLEAR_HIGHLIGHTS" }
  | { type: "MARK_EXPLORED"; file: string }
  | { type: "SET_HOT_PATH"; files: string[]; summary: string | null }
  | { type: "SET_HOT_PATH_READY"; ready: boolean }
  | { type: "AI_MENTIONS_FILES"; files: string[] }
  | { type: "CLEAR_PENDING_NAVIGATION" }
  | { type: "SCROLL_TO_LINE"; line: number | null };

function reducer(state: TriPanelState, action: Action): TriPanelState {
  switch (action.type) {
    case "NAVIGATE_TO_FILE": {
      const newExplored = new Set(state.exploredFiles);
      newExplored.add(action.file);

      // Build new highlights: keep hot-path, clear old ai-mentioned
      const newHighlights: Record<string, FileStatus> = {};
      for (const [f, s] of Object.entries(state.highlightedFiles)) {
        if (s === "hot-path") newHighlights[f] = s;
      }

      return {
        ...state,
        activeFile: action.file,
        scrollToLine: action.line ?? null,
        aiContextFile: action.file,
        selectedCode: null,
        activeFileContent: null, // will be loaded by effect
        exploredFiles: newExplored,
        highlightedFiles: newHighlights,
        pendingNavigation: { file: action.file, line: action.line, source: action.source },
      };
    }

    case "SET_ACTIVE_FILE_CONTENT":
      return { ...state, activeFileContent: action.content };

    case "SELECT_CODE":
      return { ...state, selectedCode: action.selection };

    case "CLEAR_SELECTION":
      return { ...state, selectedCode: null };

    case "HIGHLIGHT_FILES": {
      const merged = { ...state.highlightedFiles };
      for (const [f, s] of Object.entries(action.files)) {
        // Don't overwrite hot-path with lower priority
        if (merged[f] === "hot-path" && s !== "hot-path") continue;
        merged[f] = s;
      }
      return { ...state, highlightedFiles: merged };
    }

    case "CLEAR_HIGHLIGHTS":
      return { ...state, highlightedFiles: {} };

    case "MARK_EXPLORED": {
      const newExplored = new Set(state.exploredFiles);
      newExplored.add(action.file);
      return { ...state, exploredFiles: newExplored };
    }

    case "SET_HOT_PATH": {
      const highlights: Record<string, FileStatus> = { ...state.highlightedFiles };
      for (const f of action.files) {
        highlights[f] = "hot-path";
      }
      return {
        ...state,
        hotPathFiles: action.files,
        hotPathSummary: action.summary,
        highlightedFiles: highlights,
      };
    }

    case "SET_HOT_PATH_READY":
      return { ...state, hotPathReady: action.ready };

    case "AI_MENTIONS_FILES": {
      const merged = { ...state.highlightedFiles };
      for (const f of action.files) {
        if (merged[f] !== "hot-path") {
          merged[f] = "ai-mentioned";
        }
      }
      return { ...state, highlightedFiles: merged };
    }

    case "CLEAR_PENDING_NAVIGATION":
      return { ...state, pendingNavigation: null };

    case "SCROLL_TO_LINE":
      return { ...state, scrollToLine: action.line };

    default:
      return state;
  }
}

// ─── Initial State ─────────────────────────────────

const initialState: TriPanelState = {
  activeFile: null,
  highlightedFiles: {},
  scrollToLine: null,
  aiContextFile: null,
  selectedCode: null,
  pendingNavigation: null,
  exploredFiles: new Set(),
  hotPathFiles: [],
  hotPathReady: false,
  hotPathSummary: null,
  activeFileContent: null,
};

// ─── Context ───────────────────────────────────────

interface TriPanelContextValue {
  state: TriPanelState;
  dispatch: React.Dispatch<Action>;
  /** Navigate to a file (from any panel) — triggers tri-panel sync */
  navigateToFile: (file: string, line?: number, source?: "ai" | "tree" | "code") => void;
  /** Set code selection from CodeViewer */
  selectCode: (selection: CodeSelection | null) => void;
  /** Mark files mentioned in AI output */
  aiMentionsFiles: (files: string[]) => void;
  /** Set hot path files after analysis */
  setHotPath: (files: string[], summary: string | null) => void;
  /** Get file status for tree rendering */
  getFileStatus: (path: string) => FileStatus | "explored" | null;
}

const TriPanelContext = createContext<TriPanelContextValue | null>(null);

export function TriPanelProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const navigateToFile = useCallback(
    (file: string, line?: number, source: "ai" | "tree" | "code" = "tree") => {
      dispatch({ type: "NAVIGATE_TO_FILE", file, line, source });
    },
    []
  );

  const selectCode = useCallback(
    (selection: CodeSelection | null) => {
      dispatch({ type: "SELECT_CODE", selection });
    },
    []
  );

  const aiMentionsFiles = useCallback(
    (files: string[]) => {
      dispatch({ type: "AI_MENTIONS_FILES", files });
    },
    []
  );

  const setHotPath = useCallback(
    (files: string[], summary: string | null) => {
      dispatch({ type: "SET_HOT_PATH", files, summary });
      dispatch({ type: "SET_HOT_PATH_READY", ready: true });
    },
    []
  );

  const getFileStatus = useCallback(
    (path: string): FileStatus | "explored" | null => {
      if (state.highlightedFiles[path]) return state.highlightedFiles[path];
      if (state.exploredFiles.has(path)) return "explored";
      return null;
    },
    [state.highlightedFiles, state.exploredFiles]
  );

  return (
    <TriPanelContext.Provider
      value={{ state, dispatch, navigateToFile, selectCode, aiMentionsFiles, setHotPath, getFileStatus }}
    >
      {children}
    </TriPanelContext.Provider>
  );
}

export function useTriPanel() {
  const ctx = useContext(TriPanelContext);
  if (!ctx) throw new Error("useTriPanel must be used within TriPanelProvider");
  return ctx;
}
