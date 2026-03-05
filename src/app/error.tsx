"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-b from-slate-50 to-white px-6 dark:from-slate-950 dark:to-slate-900">
      <AlertTriangle className="h-12 w-12 text-red-500" />
      <div className="text-center">
        <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">
          出了点问题
        </h1>
        <p className="max-w-md text-sm text-slate-600 dark:text-slate-400">
          {error.message || "发生了未知错误，请重试或返回首页。"}
        </p>
      </div>
      <div className="flex gap-3">
        <Button onClick={reset} variant="outline" className="gap-1.5">
          <RotateCcw className="h-4 w-4" />
          重试
        </Button>
        <Link href="/">
          <Button className="gap-1.5">
            <Home className="h-4 w-4" />
            返回首页
          </Button>
        </Link>
      </div>
    </div>
  );
}
