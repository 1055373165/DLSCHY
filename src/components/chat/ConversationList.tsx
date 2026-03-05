"use client";

import { useState } from "react";
import type { Conversation } from "@/lib/conversations/types";
import { getChildConversations } from "@/lib/conversations/store";
import {
  MessageSquare,
  Plus,
  ChevronRight,
  ChevronDown,
  Trash2,
  GitBranch,
} from "lucide-react";

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onNewChild: (parentId: string) => void;
  onDelete: (id: string) => void;
}

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onNew,
  onNewChild,
  onDelete,
}: ConversationListProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-700">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          对话历史
        </span>
        <button
          onClick={onNew}
          className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          title="新建对话"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {conversations.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-slate-400">
            暂无对话记录
          </p>
        ) : (
          conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              activeId={activeId}
              depth={0}
              onSelect={onSelect}
              onNewChild={onNewChild}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ConversationItem({
  conversation,
  activeId,
  depth,
  onSelect,
  onNewChild,
  onDelete,
}: {
  conversation: Conversation;
  activeId: string | null;
  depth: number;
  onSelect: (id: string) => void;
  onNewChild: (parentId: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<Conversation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const isActive = activeId === conversation.id;
  const hasChildren = conversation.childSummaries.length > 0;

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!loaded) {
      setChildren(getChildConversations(conversation.id));
      setLoaded(true);
    }
    setExpanded(!expanded);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(conversation.id);
  };

  const handleFork = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNewChild(conversation.id);
  };

  const timeLabel = formatTime(conversation.updatedAt);

  return (
    <div>
      <button
        onClick={() => onSelect(conversation.id)}
        className={`group flex w-full items-start gap-2 rounded-md px-3 py-2 text-left transition-colors ${
          isActive
            ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
            : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50"
        }`}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
      >
        {/* Expand toggle for items with children */}
        {hasChildren ? (
          <span
            onClick={toggleExpand}
            className="mt-0.5 shrink-0 cursor-pointer rounded p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </span>
        ) : (
          <span className="mt-0.5 w-4 shrink-0" />
        )}

        <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-50" />

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{conversation.title}</p>
          <div className="flex items-center gap-2 text-[10px] opacity-60">
            <span>{timeLabel}</span>
            {conversation.parentId && (
              <span className="flex items-center gap-0.5">
                <GitBranch className="h-2.5 w-2.5" />
                子对话
              </span>
            )}
            {conversation.childSummaries.length > 0 && (
              <span>{conversation.childSummaries.length} 个子对话</span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <span
            onClick={handleFork}
            className="rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-700"
            title="创建子对话"
          >
            <GitBranch className="h-3 w-3" />
          </span>
          <span
            onClick={handleDelete}
            className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
            title="删除"
          >
            <Trash2 className="h-3 w-3" />
          </span>
        </div>
      </button>

      {/* Children */}
      {expanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <ConversationItem
              key={child.id}
              conversation={child}
              activeId={activeId}
              depth={depth + 1}
              onSelect={onSelect}
              onNewChild={onNewChild}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function formatTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}天前`;
  return new Date(ts).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });
}
