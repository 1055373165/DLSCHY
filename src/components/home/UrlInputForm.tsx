"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Github, Search } from "lucide-react";

export function UrlInputForm() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (match) {
      router.push(`/project/new?url=${encodeURIComponent(url)}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-2xl gap-3">
      <div className="relative flex-1">
        <Github className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <Input
          type="url"
          placeholder="https://github.com/owner/repo"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="h-12 pl-10 text-base"
        />
      </div>
      <Button
        type="submit"
        size="lg"
        disabled={loading || !url.trim()}
        className="h-12 gap-2 bg-indigo-600 px-6 hover:bg-indigo-700"
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : (
          <Search className="h-4 w-4" />
        )}
        开始学习
      </Button>
    </form>
  );
}
