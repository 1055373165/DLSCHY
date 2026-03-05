"use client";

import { type ReactNode, useCallback, useRef, useState } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { FolderTree, Code2, MessageCircle } from "lucide-react";

interface WorkspaceShellProps {
  sidebar: ReactNode;
  center: ReactNode;
  chat: ReactNode;
}

type MobileTab = "files" | "code" | "chat";

export function WorkspaceShell({ sidebar, center, chat }: WorkspaceShellProps) {
  const { sidebarOpen, sidebarWidth, chatPanelWidth, setSidebarWidth, setChatPanelWidth } =
    useWorkspaceStore();
  const [mobileTab, setMobileTab] = useState<MobileTab>("code");

  return (
    <>
      {/* Desktop layout (md+) */}
      <div className="hidden h-full min-h-0 flex-1 md:flex">
        {/* Left: File Tree Sidebar */}
        {sidebarOpen && (
          <>
            <div
              className="shrink-0 overflow-y-auto border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
              style={{ width: sidebarWidth }}
            >
              {sidebar}
            </div>
            <ResizeHandle
              onResize={(delta) => setSidebarWidth(Math.max(180, Math.min(400, sidebarWidth + delta)))}
            />
          </>
        )}

        {/* Center: Code Viewer / Topology Graph */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {center}
        </div>

        {/* Right: Chat Panel */}
        <ResizeHandle
          onResize={(delta) => setChatPanelWidth(Math.max(300, Math.min(700, chatPanelWidth - delta)))}
        />
        <div
          className="relative shrink-0 overflow-hidden border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
          style={{ width: chatPanelWidth }}
        >
          {chat}
        </div>
      </div>

      {/* Mobile layout (<md) */}
      <div className="flex h-full min-h-0 flex-1 flex-col md:hidden">
        <div className="flex-1 overflow-hidden">
          {mobileTab === "files" && (
            <div className="h-full overflow-y-auto bg-white dark:bg-slate-950">{sidebar}</div>
          )}
          {mobileTab === "code" && (
            <div className="flex h-full flex-col overflow-hidden">{center}</div>
          )}
          {mobileTab === "chat" && (
            <div className="h-full overflow-hidden bg-white dark:bg-slate-950">{chat}</div>
          )}
        </div>
        {/* Mobile tab bar */}
        <div className="flex shrink-0 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          {([
            { tab: "files" as MobileTab, icon: FolderTree, label: "文件" },
            { tab: "code" as MobileTab, icon: Code2, label: "代码" },
            { tab: "chat" as MobileTab, icon: MessageCircle, label: "AI" },
          ]).map(({ tab, icon: Icon, label }) => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                mobileTab === tab
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-slate-400 dark:text-slate-500"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function ResizeHandle({ onResize }: { onResize: (delta: number) => void }) {
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startXRef.current = e.clientX;
      setDragging(true);

      const handleMouseMove = (me: MouseEvent) => {
        const delta = me.clientX - startXRef.current;
        startXRef.current = me.clientX;
        onResize(delta);
      };

      const handleMouseUp = () => {
        setDragging(false);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [onResize]
  );

  return (
    <div
      className={`group relative w-1 shrink-0 cursor-col-resize ${
        dragging ? "bg-indigo-400" : "hover:bg-indigo-300"
      }`}
      onMouseDown={handleMouseDown}
    >
      <div className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  );
}
