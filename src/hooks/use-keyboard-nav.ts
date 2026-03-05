"use client";

import { useEffect } from "react";
import { useGraphStore } from "@/stores/graph-store";
import { useNavigationStore } from "@/stores/navigation-store";
import { useWorkspaceStore } from "@/stores/workspace-store";

/**
 * 全局键盘导航快捷键
 * - Cmd+Shift+G: 打开/关闭北极星图（Decision 10）
 * - Escape: 关闭北极星 overlay
 * - Alt+←/→: 导航历史前进/后退（Decision 9a）
 * - Cmd+Shift+O: 切换符号大纲面板
 */
export function useKeyboardNav() {
  const { northStarOpen, toggleNorthStar, closeNorthStar } = useGraphStore();
  const goBack = useNavigationStore((s) => s.goBack);
  const goForward = useNavigationStore((s) => s.goForward);
  const toggleOutline = useNavigationStore((s) => s.toggleOutline);
  const navigateToFile = useWorkspaceStore((s) => s.navigateToFile);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd+Shift+G → toggle North Star
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "g") {
        e.preventDefault();
        toggleNorthStar();
        return;
      }

      // Cmd+Shift+O → toggle symbol outline
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "o") {
        e.preventDefault();
        toggleOutline();
        return;
      }

      // Escape → close North Star overlay
      if (e.key === "Escape" && northStarOpen) {
        e.preventDefault();
        closeNorthStar();
        return;
      }

      // Alt+← → navigate back
      if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        const entry = goBack();
        if (entry) navigateToFile(entry.file, entry.line, "code");
        return;
      }

      // Alt+→ → navigate forward
      if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        const entry = goForward();
        if (entry) navigateToFile(entry.file, entry.line, "code");
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [northStarOpen, toggleNorthStar, closeNorthStar, goBack, goForward, navigateToFile, toggleOutline]);
}
