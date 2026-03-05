"use client";

import { type ReactNode, use } from "react";
import { WorkspaceTopBar } from "@/components/layout/WorkspaceTopBar";
import { NorthStarOverlay } from "@/components/north-star/NorthStarOverlay";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useCmdL } from "@/hooks/use-cmd-l";
import { useKeyboardNav } from "@/hooks/use-keyboard-nav";
import { useEffect } from "react";

export default function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = use(params);

  return (
    <WorkspaceLayoutInner owner={owner} repo={repo}>
      {children}
    </WorkspaceLayoutInner>
  );
}

function WorkspaceLayoutInner({
  children,
  owner,
  repo,
}: {
  children: ReactNode;
  owner: string;
  repo: string;
}) {
  const setProject = useWorkspaceStore((s) => s.setProject);

  // Initialize project info in store
  useEffect(() => {
    setProject(owner, repo);
  }, [owner, repo, setProject]);

  // Register global keyboard shortcuts
  useCmdL();
  useKeyboardNav();

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-slate-950">
      <WorkspaceTopBar />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
      <NorthStarOverlay />
    </div>
  );
}
