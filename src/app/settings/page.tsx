"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Code2,
  ArrowLeft,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Settings,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { useTheme } from "next-themes";

type Provider = "deepseek" | "doubao" | "tongyi";

interface ProviderConfig {
  id: Provider;
  name: string;
  description: string;
  envKeyName: string;
  docsUrl: string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    description: "深度求索，高性价比的大语言模型",
    envKeyName: "DEEPSEEK_API_KEY",
    docsUrl: "https://platform.deepseek.com/",
  },
  {
    id: "doubao",
    name: "豆包 (Doubao)",
    description: "字节跳动的 AI 大模型，基于火山引擎",
    envKeyName: "DOUBAO_API_KEY",
    docsUrl: "https://www.volcengine.com/product/doubao",
  },
  {
    id: "tongyi",
    name: "通义千问 (Tongyi)",
    description: "阿里云百炼平台大语言模型",
    envKeyName: "TONGYI_API_KEY",
    docsUrl: "https://bailian.console.aliyun.com/",
  },
];

export default function SettingsPage() {
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [defaultProvider, setDefaultProvider] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("hsc_default_provider") || "deepseek";
    }
    return "deepseek";
  });
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    fetch("/api/providers")
      .then((r) => r.json())
      .then((data) => {
        setAvailableProviders(data.providers || []);
      })
      .catch(() => {});
  }, []);

  const toggleShowKey = (id: string) => {
    setShowKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-6">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            <Code2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </Link>
          <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              设置
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">
          AI 服务配置
        </h1>
        <p className="mb-8 text-slate-600 dark:text-slate-400">
          配置 AI 模型提供商。API Key 存储在服务端 <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">.env</code> 文件中。
        </p>

        {/* Info banner */}
        <Card className="mb-8 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
          <CardContent className="flex items-start gap-3 pt-5">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="text-sm text-amber-800 dark:text-amber-300">
              <p className="mb-1 font-medium">API Key 配置说明</p>
              <p>
                请在项目根目录的 <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">.env</code> 文件中设置对应的 API Key。
                复制 <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">.env.example</code> 为 <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">.env</code> 并填入你的密钥即可。
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Provider cards */}
        <div className="space-y-4">
          {PROVIDERS.map((provider) => {
            const isAvailable = availableProviders.includes(provider.id);
            const isDefault = defaultProvider === provider.id;

            return (
              <Card
                key={provider.id}
                className={`border transition-colors ${
                  isDefault
                    ? "border-indigo-300 dark:border-indigo-700"
                    : "border-slate-200 dark:border-slate-800"
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-base">{provider.name}</CardTitle>
                      {isAvailable ? (
                        <Badge className="gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          <Check className="h-3 w-3" />
                          已配置
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-400">
                          未配置
                        </Badge>
                      )}
                      {isDefault && (
                        <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                          默认
                        </Badge>
                      )}
                    </div>
                    {!isDefault && isAvailable && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDefaultProvider(provider.id);
                          localStorage.setItem("hsc_default_provider", provider.id);
                          setSaved(true);
                          setTimeout(() => setSaved(false), 2000);
                        }}
                      >
                        设为默认
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
                    {provider.description}
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <Input
                        type={showKeys[provider.id] ? "text" : "password"}
                        value={isAvailable ? "••••••••••••••••" : ""}
                        placeholder={`${provider.envKeyName} 未设置`}
                        disabled
                        className="pr-10 text-sm"
                      />
                      <button
                        onClick={() => toggleShowKey(provider.id)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showKeys[provider.id] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <a
                      href={provider.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      获取 API Key
                    </a>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    环境变量: <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">{provider.envKeyName}</code>
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Theme settings */}
        <div className="mt-10">
          <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">
            外观设置
          </h2>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">主题</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {[
                  { value: "light", label: "亮色", icon: Sun },
                  { value: "dark", label: "暗色", icon: Moon },
                  { value: "system", label: "跟随系统", icon: Monitor },
                ].map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                      theme === value
                        ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Save notification */}
        {saved && (
          <div className="fixed bottom-6 right-6 flex items-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-sm text-white shadow-lg">
            <Check className="h-4 w-4" />
            设置已更新
          </div>
        )}
      </main>
    </div>
  );
}
