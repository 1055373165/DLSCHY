/**
 * 对话持久化存储 — localStorage 实现
 * 支持 CRUD、按项目过滤、父子关系查询
 */

import type { Conversation, ConversationMessage, ChildSummary } from "./types";

const STORAGE_KEY = "happy_sourcecode_conversations";

function readAll(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(conversations: Conversation[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
}

export function listConversations(
  projectOwner: string,
  projectRepo: string
): Conversation[] {
  return readAll()
    .filter((c) => c.projectOwner === projectOwner && c.projectRepo === projectRepo)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function listRootConversations(
  projectOwner: string,
  projectRepo: string
): Conversation[] {
  return listConversations(projectOwner, projectRepo).filter(
    (c) => c.parentId === null
  );
}

export function getConversation(id: string): Conversation | null {
  return readAll().find((c) => c.id === id) || null;
}

export function getChildConversations(parentId: string): Conversation[] {
  return readAll()
    .filter((c) => c.parentId === parentId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function createConversation(
  projectOwner: string,
  projectRepo: string,
  title: string,
  parentId: string | null = null
): Conversation {
  const now = Date.now();
  const conversation: Conversation = {
    id: `conv-${now}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    parentId,
    projectOwner,
    projectRepo,
    messages: [],
    childSummaries: [],
    createdAt: now,
    updatedAt: now,
  };

  const all = readAll();
  all.push(conversation);
  writeAll(all);
  return conversation;
}

export function updateMessages(
  id: string,
  messages: ConversationMessage[]
): void {
  const all = readAll();
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1) return;
  all[idx].messages = messages;
  all[idx].updatedAt = Date.now();
  // Auto-update title from first user message if still default
  if (all[idx].title === "新对话" && messages.length > 0) {
    const firstUser = messages.find((m) => m.role === "user");
    if (firstUser) {
      all[idx].title = firstUser.content.slice(0, 50) + (firstUser.content.length > 50 ? "..." : "");
    }
  }
  writeAll(all);
}

export function addChildSummary(
  parentId: string,
  summary: ChildSummary
): void {
  const all = readAll();
  const idx = all.findIndex((c) => c.id === parentId);
  if (idx === -1) return;
  // Replace existing summary for the same child, or add new
  const existing = all[idx].childSummaries.findIndex(
    (s) => s.childId === summary.childId
  );
  if (existing >= 0) {
    all[idx].childSummaries[existing] = summary;
  } else {
    all[idx].childSummaries.push(summary);
  }
  all[idx].updatedAt = Date.now();
  writeAll(all);
}

export function updateTitle(id: string, title: string): void {
  const all = readAll();
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1) return;
  all[idx].title = title;
  all[idx].updatedAt = Date.now();
  writeAll(all);
}

export function deleteConversation(id: string): void {
  const all = readAll();
  // Delete this conversation and all its descendants
  const toDelete = new Set<string>();
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.shift()!;
    toDelete.add(current);
    for (const c of all) {
      if (c.parentId === current && !toDelete.has(c.id)) {
        queue.push(c.id);
      }
    }
  }
  writeAll(all.filter((c) => !toDelete.has(c.id)));
}
