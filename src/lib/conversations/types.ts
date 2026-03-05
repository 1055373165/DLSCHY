/**
 * 对话数据模型 — 支持父子对话树结构
 * 
 * 设计理念：
 * - 父对话保持主线上下文清晰
 * - 子对话用于深入探索某个具体主题
 * - 子对话结束后，压缩摘要同步回父对话
 */

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface ChildSummary {
  childId: string;
  title: string;
  summary: string;
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  parentId: string | null;
  projectOwner: string;
  projectRepo: string;
  messages: ConversationMessage[];
  childSummaries: ChildSummary[];
  createdAt: number;
  updatedAt: number;
}

export interface ConversationTree {
  conversation: Conversation;
  children: ConversationTree[];
}
