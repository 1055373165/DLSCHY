"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageContent } from "./MessageContent";
import { ConversationList } from "./ConversationList";
import {
  Send,
  Loader2,
  Bot,
  User,
  RotateCcw,
  History,
  GitBranch,
  ArrowLeft,
  X,
  ChevronDown,
} from "lucide-react";
import type { Conversation, ConversationMessage } from "@/lib/conversations/types";
import {
  listRootConversations,
  getConversation,
  createConversation,
  updateMessages,
  addChildSummary,
  deleteConversation,
} from "@/lib/conversations/store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { ChallengeScoreboard } from "@/components/challenge/ChallengeScoreboard";
import { useHotPathStore } from "@/stores/hotpath-store";
import { useChatStore } from "@/stores/chat-store";
import { useProgressStore } from "@/stores/progress-store";
import type { ConversationSummary } from "@/lib/conversations/summarizer";
import {
  shouldSummarize,
  getMessagesToSummarize,
  buildLocalSummary,
  condenseMessages,
} from "@/lib/conversations/summarizer";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatInterfaceProps {
  projectName: string;
  projectUrl: string;
  projectDescription?: string;
  currentFile?: string;
  currentFileContent?: string;
  onFileNavigate?: (path: string) => void;
}

function toStoreMessages(messages: Message[]): ConversationMessage[] {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: parseInt(m.id.split("-")[1]) || Date.now(),
  }));
}

function fromStoreMessages(messages: ConversationMessage[]): Message[] {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
  }));
}

function compressContext(messages: Message[]): string {
  // Take last N messages and summarize them
  const recent = messages.slice(-6);
  const parts: string[] = [];
  for (const m of recent) {
    if (m.role === "user") {
      parts.push(`用户问: ${m.content.slice(0, 100)}`);
    } else if (m.content) {
      parts.push(`AI答: ${m.content.slice(0, 200)}`);
    }
  }
  return parts.join("\n");
}

export function ChatInterface({
  projectName,
  projectUrl,
  projectDescription,
  currentFile,
  currentFileContent,
  onFileNavigate,
}: ChatInterfaceProps) {
  const selectedCode = useWorkspaceStore((s) => s.selectedCode);
  const clearSelection = useWorkspaceStore((s) => s.selectCode);
  const aiMentionsFiles = useWorkspaceStore((s) => s.aiMentionsFiles);
  const hotPathReady = useHotPathStore((s) => s.ready);
  const hotPathSummary = useHotPathStore((s) => s.structureSummary);
  const pendingCodeToAI = useChatStore((s) => s.pendingCodeToAI);
  const consumePendingCode = useChatStore((s) => s.consumePendingCode);
  const viewMode = useProgressStore((s) => s.viewMode);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [parentConv, setParentConv] = useState<Conversation | null>(null);
  const [summaries, setSummaries] = useState<ConversationSummary[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const initRef = useRef(false);
  const userScrolledUpRef = useRef(false);
  const summarizingRef = useRef(false);
  const [showScrollDown, setShowScrollDown] = useState(false);

  // Parse owner/repo from projectName (e.g. "kubernetes/kubernetes")
  const [projectOwner, projectRepo] = projectName.includes("/")
    ? projectName.split("/")
    : ["", projectName];

  // Refresh conversation list
  const refreshList = useCallback(() => {
    setConversations(listRootConversations(projectOwner, projectRepo));
  }, [projectOwner, projectRepo]);

  // Decision 9b: Listen for focus-ai-input event (from Cmd+L with no selection)
  useEffect(() => {
    const handler = () => textareaRef.current?.focus();
    window.addEventListener("focus-ai-input", handler);
    return () => window.removeEventListener("focus-ai-input", handler);
  }, []);

  // Detect user scroll position to decide whether to auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const threshold = 150;
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      const isNearBottom = distanceFromBottom < threshold;
      userScrolledUpRef.current = !isNearBottom;
      setShowScrollDown(!isNearBottom && isStreaming);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [isStreaming]);

  // Auto-scroll to bottom on new messages — only if user hasn't scrolled up
  useEffect(() => {
    if (scrollRef.current && !userScrolledUpRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      userScrolledUpRef.current = false;
      setShowScrollDown(false);
    }
  }, []);

  // Persist messages whenever they change (debounced during streaming, immediate after)
  const persistRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef<Message[]>(messages);
  messagesRef.current = messages;

  const persistNow = useCallback(() => {
    const cid = conversationIdRef.current;
    const msgs = messagesRef.current;
    if (!cid || msgs.length === 0) return;
    updateMessages(cid, toStoreMessages(msgs));
    refreshList();
  }, [refreshList]);

  useEffect(() => {
    if (!conversationId || messages.length === 0) return;
    if (persistRef.current) clearTimeout(persistRef.current);
    persistRef.current = setTimeout(() => {
      persistNow();
    }, 1000);
    return () => {
      if (persistRef.current) clearTimeout(persistRef.current);
    };
  }, [messages, conversationId, persistNow]);

  // Persist on tab close / navigation
  useEffect(() => {
    const handler = () => persistNow();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [persistNow]);

  // Phase 5.4: Auto-summarize when message count crosses threshold
  useEffect(() => {
    if (isStreaming || summarizingRef.current) return;
    if (!shouldSummarize(messages.length, summaries.length)) return;

    const toSummarize = getMessagesToSummarize(messages, summaries);
    if (toSummarize.length === 0) return;

    summarizingRef.current = true;
    const summaryContent = buildLocalSummary(toSummarize);
    const newSummary: ConversationSummary = {
      id: `sum-${Date.now()}`,
      content: summaryContent,
      coveredMessageIds: toSummarize.map((m) => m.id),
      createdAt: Date.now(),
    };
    setSummaries((prev) => [...prev, newSummary]);
    summarizingRef.current = false;
  }, [isStreaming, messages, summaries]);

  // Track whether this is a first-time visit (no prior conversations)
  const isFirstVisitRef = useRef(true);

  // On mount: refresh conversation list and show history panel so user can choose
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const convs = listRootConversations(projectOwner, projectRepo);
    setConversations(convs);

    // If there are existing conversations, this is NOT the first visit
    if (convs.length > 0) {
      isFirstVisitRef.current = false;
      setShowHistory(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tri-Panel Sync: auto-send code selection from CodeViewer to AI
  const codeSelectionRef = useRef(selectedCode);
  useEffect(() => {
    const sel = selectedCode;
    if (!sel || sel === codeSelectionRef.current || isStreaming) return;
    codeSelectionRef.current = sel;

    const isDesignIntent = sel.text.startsWith("[设计意图] ");
    const cleanText = isDesignIntent ? sel.text.replace("[设计意图] ", "") : sel.text;
    const prompt = isDesignIntent
      ? `请分析以下代码片段的设计意图和架构决策：\n\n文件: \`${sel.file}\` (第${sel.startLine}-${sel.endLine}行)\n\`\`\`\n${cleanText}\n\`\`\`\n\n为什么作者这样设计？有什么替代方案？这个设计有什么优缺点？`
      : `请解释以下代码片段：\n\n文件: \`${sel.file}\` (第${sel.startLine}-${sel.endLine}行)\n\`\`\`\n${cleanText}\n\`\`\`\n\n请说明这段代码的作用、关键逻辑和在项目中的角色。`;

    // Clear the selection in shared state
    clearSelection(null);
    // Auto-send the prompt
    handleSendDirect(prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCode]);

  // Decision 6: Proactive AI — auto-send hot path explanation ONLY on first visit
  const hotPathSentRef = useRef(false);
  useEffect(() => {
    if (hotPathSentRef.current || isStreaming || !hotPathReady) return;
    if (!hotPathSummary) return;
    // Only auto-send if no messages yet (fresh conversation)
    if (messages.length > 0) return;
    // Skip auto-analysis if this project has been visited before
    if (!isFirstVisitRef.current) return;
    hotPathSentRef.current = true;

    const prompt = `我刚打开了 ${projectName} 项目。以下是基于 import 图自动识别的核心路径分析结果：\n\n${hotPathSummary}\n\n请基于这个分析，用通俗易懂的方式向我介绍这个项目的核心机制。从入口点开始，带我理解最热路径上的关键代码是如何协作的。不要让我选择方向，直接带我进入最核心的部分。`;

    handleSendDirect(prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotPathReady, hotPathSummary, messages.length]);

  // Decision 9b: Cmd+L — consume pending code snippet and fill input
  useEffect(() => {
    if (!pendingCodeToAI || isStreaming) return;
    const snippet = consumePendingCode();
    if (!snippet) return;

    const prefill = `文件: \`${snippet.file}\` (第${snippet.startLine}-${snippet.endLine}行)\n\`\`\`\n${snippet.text}\n\`\`\`\n\n`;
    setInput(prefill);
    // Focus the textarea
    setTimeout(() => textareaRef.current?.focus(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCodeToAI]);

  // Tri-Panel Sync: extract file paths from AI responses and highlight in tree
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== "assistant" || !lastMsg.content) return;

    // Extract file paths from backtick-wrapped inline code
    const pathRegex = /`([a-zA-Z0-9_.\-/]+\.[a-zA-Z0-9]+)`/g;
    const paths: string[] = [];
    let match;
    while ((match = pathRegex.exec(lastMsg.content)) !== null) {
      const p = match[1];
      if (p.includes("/") && !p.startsWith("http")) {
        paths.push(p);
      }
    }
    if (paths.length > 0) {
      aiMentionsFiles(paths);
    }
  }, [messages, aiMentionsFiles]);

  // Core send logic — extracted to allow passing conversationId directly
  const handleSendDirect = async (messageText: string, convId?: string) => {
    if (!messageText || isStreaming) return;

    // Auto-create a conversation if none exists yet
    let activeConvId = convId || conversationIdRef.current;
    if (!activeConvId) {
      const conv = createConversation(projectOwner, projectRepo, "新对话");
      activeConvId = conv.id;
      setConversationId(conv.id);
      conversationIdRef.current = conv.id;
      refreshList();
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageText,
    };

    const assistantMessage: Message = {
      id: `assistant-${Date.now() + 1}`,
      role: "assistant",
      content: "",
    };

    userScrolledUpRef.current = false;
    setShowScrollDown(false);
    setMessages((prev) => {
      const updated = [...prev, userMessage, assistantMessage];
      return updated;
    });
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Build context including parent's child summaries if this is a child conversation
      let parentContext = "";
      if (activeConvId) {
        const conv = getConversation(activeConvId);
        if (conv?.parentId) {
          const parent = getConversation(conv.parentId);
          if (parent) {
            setParentConv(parent);
            // Include parent's child summaries as context
            if (parent.childSummaries.length > 0) {
              parentContext = parent.childSummaries
                .map((s) => `[子对话"${s.title}"摘要]: ${s.summary}`)
                .join("\n");
            }
          }
        }
      }

      // Phase 5.4: Condense old messages with summaries to manage context window
      const condensed = condenseMessages([...messages, userMessage], summaries);
      const allMessages = condensed.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Read persisted default provider preference
      const storedProvider = typeof window !== "undefined"
        ? localStorage.getItem("hsc_default_provider") || undefined
        : undefined;

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: allMessages,
          provider: storedProvider,
          context: {
            projectName,
            projectDescription,
            currentFile,
            fileContent: currentFileContent,
            analysisResults: parentContext || undefined,
            viewMode,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "请求失败");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const data = trimmed.slice(6);
          if (data === "[DONE]") break;

          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              throw new Error(parsed.error);
            }
            if (parsed.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessage.id
                    ? { ...m, content: m.content + parsed.content }
                    : m
                )
              );
            }
          } catch (e) {
            if (e instanceof Error && e.message !== "Unexpected end of JSON input") {
              if (!e.message.includes("JSON")) throw e;
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") return;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessage.id
            ? {
                ...m,
                content:
                  m.content ||
                  `**错误：** ${(error as Error).message}\n\n请检查 AI 服务配置（.env 中的 API Key）后重试。`,
              }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      setShowScrollDown(false);
      // Persist immediately when streaming ends
      setTimeout(() => persistNow(), 50);
    }
  };

  const handleSend = useCallback(
    async (text?: string) => {
      const messageText = text || input.trim();
      if (!messageText || isStreaming) return;
      if (!text) setInput("");
      await handleSendDirect(messageText);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [input, isStreaming, messages, projectName, projectDescription, currentFile, currentFileContent, conversationId]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
  };

  const handleRetry = () => {
    if (messages.length < 2) return;
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      setMessages((prev) => prev.slice(0, -2));
      setTimeout(() => handleSend(lastUserMsg.content), 100);
    }
  };

  // --- Conversation management ---
  const handleSelectConversation = (id: string) => {
    if (isStreaming) return;
    // Save current before switching
    if (conversationIdRef.current && messages.length > 0) {
      updateMessages(conversationIdRef.current, toStoreMessages(messages));
    }

    const conv = getConversation(id);
    if (!conv) return;

    setConversationId(id);
    conversationIdRef.current = id;
    setMessages(fromStoreMessages(conv.messages));
    setSummaries([]);
    setParentConv(conv.parentId ? getConversation(conv.parentId) : null);
    setShowHistory(false);
  };

  const handleNewConversation = () => {
    if (isStreaming) return;
    // Save current
    if (conversationIdRef.current && messages.length > 0) {
      updateMessages(conversationIdRef.current, toStoreMessages(messages));
    }

    const conv = createConversation(projectOwner, projectRepo, "新对话");
    setConversationId(conv.id);
    conversationIdRef.current = conv.id;
    setMessages([]);
    setSummaries([]);
    setParentConv(null);
    refreshList();
    setShowHistory(false);
  };

  const handleNewChildConversation = (parentId: string) => {
    if (isStreaming) return;
    // Save current
    if (conversationIdRef.current && messages.length > 0) {
      updateMessages(conversationIdRef.current, toStoreMessages(messages));
    }

    const parent = getConversation(parentId);
    if (!parent) return;

    const conv = createConversation(
      projectOwner,
      projectRepo,
      "子对话: 深入探索",
      parentId
    );
    setConversationId(conv.id);
    conversationIdRef.current = conv.id;
    setMessages([]);
    setSummaries([]);
    setParentConv(parent);
    refreshList();
    setShowHistory(false);
  };

  const handleDeleteConversation = (id: string) => {
    deleteConversation(id);
    refreshList();
    if (id === conversationIdRef.current) {
      setConversationId(null);
      conversationIdRef.current = null;
      setMessages([]);
      setParentConv(null);
    }
  };

  const handleBackToParent = () => {
    if (!parentConv || !conversationId) return;

    // Compress current child context and sync to parent
    if (messages.length > 0) {
      updateMessages(conversationId, toStoreMessages(messages));
      const conv = getConversation(conversationId);
      const summary = compressContext(messages);
      addChildSummary(parentConv.id, {
        childId: conversationId,
        title: conv?.title || "子对话",
        summary,
        createdAt: Date.now(),
      });
    }

    handleSelectConversation(parentConv.id);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Top bar with history toggle */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-slate-200 px-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          {parentConv && (
            <button
              onClick={handleBackToParent}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
              title="返回父对话（压缩当前上下文同步给父）"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>返回父对话</span>
            </button>
          )}
          {parentConv && (
            <span className="flex items-center gap-1 text-[10px] text-slate-400">
              <GitBranch className="h-3 w-3" />
              子对话
            </span>
          )}
        </div>
        <button
          onClick={() => {
            refreshList();
            setShowHistory(!showHistory);
          }}
          className={`rounded p-1.5 transition-colors ${
            showHistory
              ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400"
              : "text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          }`}
          title="对话历史"
        >
          {showHistory ? <X className="h-4 w-4" /> : <History className="h-4 w-4" />}
        </button>
      </div>

      {/* History panel (overlay) */}
      {showHistory && (
        <div className="absolute inset-0 top-10 z-10 bg-white dark:bg-slate-950">
          <ConversationList
            conversations={conversations}
            activeId={conversationId}
            onSelect={handleSelectConversation}
            onNew={handleNewConversation}
            onNewChild={handleNewChildConversation}
            onDelete={handleDeleteConversation}
          />
        </div>
      )}

      {/* Messages */}
      <div className="relative flex-1 overflow-hidden">
        <div ref={scrollRef} className="h-full overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-6">
            {messages.length === 0 && !isStreaming && (
              <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-400">
                <Bot className="h-8 w-8 opacity-30" />
                <p className="text-sm">开始一段新的对话</p>
              </div>
            )}
            {messages.length === 0 && isStreaming && (
              <div className="flex h-64 items-center justify-center text-slate-400">
                <p>正在加载...</p>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className="mb-6">
                {/* Role indicator */}
                <div className="mb-2 flex items-center gap-2">
                  {message.role === "assistant" ? (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/40">
                      <Bot className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                      <User className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    </div>
                  )}
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {message.role === "assistant" ? "AI 导师" : "你"}
                  </span>
                </div>

                {/* Content */}
                <div className="pl-9">
                  {message.role === "assistant" ? (
                    message.content ? (
                      <MessageContent content={message.content} onFileNavigate={onFileNavigate} />
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        思考中...
                      </div>
                    )
                  ) : (
                    <p className="text-slate-700 dark:text-slate-300">
                      {message.content}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll to bottom button — shown when user scrolls up during streaming */}
        {showScrollDown && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-lg transition-all hover:bg-indigo-700"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            回到最新
          </button>
        )}
      </div>

      {/* Challenge scoreboard */}
      <ChallengeScoreboard />

      {/* Input area */}
      <div className="border-t border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto max-w-3xl px-4 py-4">
          {/* Action buttons */}
          {!isStreaming && messages.length > 0 && (
            <div className="mb-3 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="gap-1.5 text-xs"
              >
                <RotateCcw className="h-3 w-3" />
                重新生成
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => conversationId && handleNewChildConversation(conversationId)}
                className="gap-1.5 text-xs"
              >
                <GitBranch className="h-3 w-3" />
                分支探索
              </Button>
            </div>
          )}

          <div className="flex gap-3">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入问题，探索源码的设计与实现..."
              rows={1}
              className="min-h-[44px] max-h-32 resize-none"
              disabled={isStreaming}
            />
            {isStreaming ? (
              <Button
                onClick={handleStop}
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0"
              >
                <div className="h-3.5 w-3.5 rounded-sm bg-slate-600 dark:bg-slate-400" />
              </Button>
            ) : (
              <Button
                onClick={() => handleSend()}
                disabled={!input.trim()}
                size="icon"
                className="h-11 w-11 shrink-0 bg-indigo-600 hover:bg-indigo-700"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>

          <p className="mt-2 text-center text-xs text-slate-400">
            Shift+Enter 换行 · Enter 发送 · AI 输出仅供参考，请结合源码验证
          </p>
        </div>
      </div>
    </div>
  );
}
