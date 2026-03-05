"use client";

import { Check, Flame } from "lucide-react";
import type { FileStatus } from "@/types/workspace";

interface FileStatusIndicatorProps {
  status: FileStatus | "explored" | null;
}

export function FileStatusIndicator({ status }: FileStatusIndicatorProps) {
  if (!status) return null;

  switch (status) {
    case "explored":
      return <Check className="h-3 w-3 shrink-0 text-emerald-500" />;
    case "ai-mentioned":
      return <span className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-blue-500" />;
    case "hot-path":
      return <Flame className="h-3 w-3 shrink-0 text-orange-500" />;
    default:
      return null;
  }
}
