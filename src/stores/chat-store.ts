/**
 * 对话状态（Decision 9b: Cmd+L 集成）
 * 
 * 管理：消息列表、流式状态、Cmd+L 待发送、对话管理
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { PendingCodeSnippet } from '@/types/analysis';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  source?: 'manual' | 'cmd-l' | 'code-select' | 'hotpath-auto' | 'proactive';
}

export interface ConversationMeta {
  id: string;
  title: string;
  parentId: string | null;
  messageCount: number;
  updatedAt: number;
}

interface ChatState {
  conversationId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  input: string;

  pendingCodeToAI: PendingCodeSnippet | null;

  conversations: ConversationMeta[];
  showHistory: boolean;
  parentConvId: string | null;
}

interface ChatActions {
  // ─── 消息 ───
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, content: string) => void;
  appendToMessage: (id: string, chunk: string) => void;
  setMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;

  // ─── 流式 ───
  setStreaming: (streaming: boolean) => void;
  setInput: (input: string) => void;

  // ─── Cmd+L（Decision 9b）───
  setPendingCode: (snippet: PendingCodeSnippet | null) => void;
  consumePendingCode: () => PendingCodeSnippet | null;

  // ─── 对话管理 ───
  setConversationId: (id: string | null) => void;
  setConversations: (convs: ConversationMeta[]) => void;
  setShowHistory: (show: boolean) => void;
  setParentConvId: (id: string | null) => void;
}

export type ChatStore = ChatState & ChatActions;

export const useChatStore = create<ChatStore>()(
  immer((set, get) => ({
    // ─── Initial State ───
    conversationId: null,
    messages: [],
    isStreaming: false,
    input: '',
    pendingCodeToAI: null,
    conversations: [],
    showHistory: false,
    parentConvId: null,

    // ─── Actions ───
    addMessage: (message) => set((state) => {
      state.messages.push(message);
    }),

    updateMessage: (id, content) => set((state) => {
      const msg = state.messages.find((m) => m.id === id);
      if (msg) msg.content = content;
    }),

    appendToMessage: (id, chunk) => set((state) => {
      const msg = state.messages.find((m) => m.id === id);
      if (msg) msg.content += chunk;
    }),

    setMessages: (messages) => set((state) => {
      state.messages = messages;
    }),

    clearMessages: () => set((state) => {
      state.messages = [];
    }),

    setStreaming: (streaming) => set((state) => {
      state.isStreaming = streaming;
    }),

    setInput: (input) => set((state) => {
      state.input = input;
    }),

    setPendingCode: (snippet) => set((state) => {
      state.pendingCodeToAI = snippet;
    }),

    consumePendingCode: () => {
      const snippet = get().pendingCodeToAI;
      if (snippet) {
        set((state) => { state.pendingCodeToAI = null; });
      }
      return snippet;
    },

    setConversationId: (id) => set((state) => {
      state.conversationId = id;
    }),

    setConversations: (convs) => set((state) => {
      state.conversations = convs;
    }),

    setShowHistory: (show) => set((state) => {
      state.showHistory = show;
    }),

    setParentConvId: (id) => set((state) => {
      state.parentConvId = id;
    }),
  }))
);
