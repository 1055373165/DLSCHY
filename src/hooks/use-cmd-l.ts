"use client";

import { useEffect } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useChatStore } from "@/stores/chat-store";

/**
 * Decision 9b: Cmd+L 快捷键
 * 选中代码 → Cmd+L → 代码自动进入 AI 输入框（带文件名+行号上下文）
 * 无选中 → Cmd+L → 聚焦 AI 输入框
 */
export function useCmdL() {
  const activeFile = useWorkspaceStore((s) => s.activeFile);
  const selectedCode = useWorkspaceStore((s) => s.selectedCode);
  const selectCode = useWorkspaceStore((s) => s.selectCode);
  const setPendingCode = useChatStore((s) => s.setPendingCode);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isCmdL = (e.metaKey || e.ctrlKey) && e.key === "l";
      if (!isCmdL) return;

      e.preventDefault();

      if (selectedCode && activeFile) {
        // Send selected code to AI input with context
        setPendingCode({
          file: selectedCode.file,
          startLine: selectedCode.startLine,
          endLine: selectedCode.endLine,
          text: selectedCode.text,
        });
        selectCode(null);
      } else {
        // No selection: just focus the AI input
        window.dispatchEvent(new CustomEvent("focus-ai-input"));
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeFile, selectedCode, selectCode, setPendingCode]);
}
