import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-b from-slate-50 to-white px-6 dark:from-slate-950 dark:to-slate-900">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
        <Search className="h-8 w-8 text-slate-400" />
      </div>
      <div className="text-center">
        <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">
          404 - 页面未找到
        </h1>
        <p className="max-w-md text-sm text-slate-600 dark:text-slate-400">
          你访问的页面不存在，请检查 URL 或返回首页开始探索。
        </p>
      </div>
      <Link href="/">
        <Button className="gap-1.5">
          <Home className="h-4 w-4" />
          返回首页
        </Button>
      </Link>
    </div>
  );
}
