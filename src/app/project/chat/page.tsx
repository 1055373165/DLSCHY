"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { Code2, ArrowLeft, Loader2 } from "lucide-react";

function ChatPageContent() {
  const searchParams = useSearchParams();
  const url = searchParams.get("url") || "";
  const name = searchParams.get("name") || extractName(url);

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-slate-950">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            <Code2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </Link>
          <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {name}
          </span>
        </div>
      </header>

      {/* Chat */}
      <div className="flex-1 overflow-hidden">
        <ChatInterface
          projectName={name}
          projectUrl={url}
        />
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        </div>
      }
    >
      <ChatPageContent />
    </Suspense>
  );
}

function extractName(url: string): string {
  const match = url.match(/github\.com\/([^/]+\/[^/\s?#]+)/);
  return match ? match[1].replace(/\.git$/, "") : "未知项目";
}
