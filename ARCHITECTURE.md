# Happy SourceCode — 架构设计文档 v2

> 基于 EXPERT_SPEC.md 决策 8-11 的重构架构设计。  
> 本文档仅输出设计，不含实现代码。验收后进入阶段二（骨架搭建）。

---

## 一、现状分析与重构动机

### 1.1 当前架构

```
src/
├── app/                          # Next.js App Router
│   ├── api/{chat,providers,github/*}  # 7 个 API 路由
│   ├── page.tsx                  # 首页（287行，包含 Header/Hero/Features/Footer）
│   ├── project/{new,chat}/       # 项目初始化 & 独立聊天
│   ├── workspace/[owner]/[repo]/ # 三面板工作区（323行，大量状态+副作用）
│   └── settings/                 # 设置页
├── components/
│   ├── chat/      # ChatInterface(667行)、MessageContent、MermaidRenderer、CodeBlock、ConversationList
│   ├── workspace/ # FileTree(253行)、CodeViewer(290行)、DependencyGraph
│   ├── challenges/# 3个挑战组件（未集成）
│   └── ui/        # shadcn 基础组件（9个）
└── lib/
    ├── ai/        # 3个适配器 + factory + prompt(context/loader)
    ├── analysis/  # hot-path、import-parser、call-analyzer、graph-builder
    ├── conversations/ # localStorage 存储
    ├── github/    # client.ts（263行）
    └── workspace/ # tri-panel-state.tsx（243行）
```

### 1.2 核心问题

| 问题 | 具体表现 | 根因 |
|------|---------|------|
| **巨型组件** | ChatInterface 667行、workspace page 323行 | 职责未拆分，UI/逻辑/副作用混在一起 |
| **状态管理笨重** | TriPanelState 用 useReducer + Context，243行仍仅覆盖基础功能 | 新增决策 8-11 的状态（热路径进度、IDE导航栈、Cmd+L、北极星图）将使其膨胀至 500+ 行 |
| **对话存储脆弱** | localStorage，无持久化、无搜索、无多设备同步 | 初期权宜之计，需迁移至服务端 |
| **分析能力分散** | hot-path / import-parser / call-analyzer / graph-builder 各自独立，无统一索引 | 缺乏"项目分析会话"概念，每次操作重复计算 |
| **代码查看器无交互** | CodeViewer 仅展示代码 + 选中浮动条 | 缺少 IDE 级能力（跳转定义、引用、符号大纲、悬停预览） |
| **拓扑图静态** | Mermaid 渲染，三个独立 tab，无 drill-down、无物理动画 | 需要北极星力导向图（Decision 10）+ 层级钻入（Decision 11） |

### 1.3 重构目标

将产品从「源码查看器 + AI 聊天」升级为「**学习加速器**」：
- 文件树 = 学习路线图（Decision 8）
- 代码面板 = 学习级 IDE（Decision 9）
- 北极星图 = 全局关系认知（Decision 10）
- 拓扑图 = 结构化架构探索（Decision 11）

---

## 二、重构后项目目录结构

```
src/
├── app/                              # ──── Next.js App Router（页面层）────
│   ├── layout.tsx                    # 根布局（字体、主题 Provider、全局样式）
│   ├── page.tsx                      # 首页（精简，委托给 components）
│   ├── error.tsx                     # 全局错误边界
│   ├── not-found.tsx                 # 404
│   ├── globals.css                   # Tailwind 入口 + CSS 变量
│   │
│   ├── project/
│   │   └── new/page.tsx              # 项目初始化（分析流水线可视化）
│   │
│   ├── workspace/
│   │   └── [owner]/[repo]/
│   │       ├── layout.tsx            # 【新增】工作区布局（TopBar + 三面板骨架 + Provider 注入）
│   │       └── page.tsx              # 三面板页面（精简，仅组装子组件）
│   │
│   ├── settings/page.tsx             # AI 服务配置
│   │
│   └── api/                          # ──── API 路由 ────
│       ├── chat/route.ts             # AI 对话（SSE 流式）
│       ├── providers/route.ts        # 可用 AI 提供者列表
│       └── github/
│           ├── repo/route.ts         # 仓库元信息
│           ├── tree/route.ts         # 文件树
│           ├── file/route.ts         # 文件内容
│           ├── hotpath/route.ts      # 热路径分析（增强：返回有序学习路径）
│           ├── dependencies/route.ts # 依赖图（三层）
│           ├── symbols/route.ts      # 【新增】文件符号索引（函数/类型/常量/导出）
│           └── references/route.ts   # 【新增】符号引用查找（跨文件）
│
├── components/                       # ──── 组件层 ────
│   │
│   ├── layout/                       # 【新增】布局组件
│   │   ├── AppHeader.tsx             # 首页 Header（从 page.tsx 提取）
│   │   ├── WorkspaceTopBar.tsx       # 工作区顶栏（从 workspace page 提取）
│   │   └── WorkspaceShell.tsx        # 三面板容器（左|中|右 分栏 + 拖拽调宽）
│   │
│   ├── home/                         # 【新增】首页业务组件
│   │   ├── HeroSection.tsx           # Hero 区域
│   │   ├── FeatureGrid.tsx           # 功能特性卡片网格
│   │   ├── ProjectCarousel.tsx       # 推荐项目卡片
│   │   └── UrlInputForm.tsx          # GitHub URL 输入表单
│   │
│   ├── file-tree/                    # 【重构】文件树（Decision 8）
│   │   ├── FileTree.tsx              # 容器：搜索 + 进度条 + 树
│   │   ├── FileTreeNode.tsx          # 单节点：目录折叠/文件点击
│   │   ├── HotPathBadge.tsx          # 【新增】序号徽章（①②③，橙色圆形，脉冲动画）
│   │   ├── HotPathProgressBar.tsx    # 【新增】热路径进度条 + "下一步"按钮
│   │   └── FileStatusIndicator.tsx   # 状态图标（已完成✓/AI提及/热路径🔥）
│   │
│   ├── code-viewer/                  # 【重构】代码查看器 = 学习级 IDE（Decision 9）
│   │   ├── CodeViewer.tsx            # 容器：摘要卡片 + 符号栏 + 代码区 + 导航面包屑
│   │   ├── CodeContent.tsx           # 代码渲染（Shiki 语法高亮 + 行号 + gutter 标注）
│   │   ├── FileSummaryCard.tsx       # 【新增】9c 文件摘要卡片（角色+标签+AI洞察，可折叠）
│   │   ├── SymbolOutline.tsx         # 【新增】9a 符号大纲（左侧折叠栏）
│   │   ├── HoverPreview.tsx          # 【新增】9a 符号悬停预览（Tooltip）
│   │   ├── RegionAnnotation.tsx      # 【新增】9c 代码区域标注（gutter 彩色条 + 内联AI说明）
│   │   ├── SelectionActionBar.tsx    # 重构：选中代码浮动操作条（解释/设计意图/发送AI）
│   │   └── NavigationBreadcrumb.tsx  # 【新增】9a 跳转历史面包屑（Alt+←/→）
│   │
│   ├── chat/                         # 【重构】AI 对话
│   │   ├── ChatPanel.tsx             # 容器：历史 + 消息列表 + 输入区
│   │   ├── ChatMessageList.tsx       # 【拆分】消息列表（虚拟滚动）
│   │   ├── ChatMessage.tsx           # 【拆分】单条消息（角色图标 + 内容）
│   │   ├── ChatInput.tsx             # 【拆分】输入区（Textarea + 发送/停止 + 快捷操作）
│   │   ├── ChatHistory.tsx           # 【拆分】对话历史列表（原 ConversationList）
│   │   ├── MessageContent.tsx        # Markdown 渲染（保留）
│   │   ├── MermaidRenderer.tsx       # Mermaid 图渲染（保留）
│   │   └── CodeBlock.tsx             # 代码块（保留）
│   │
│   ├── north-star/                   # 【新增】北极星图（Decision 10）
│   │   ├── NorthStarButton.tsx       # 右上角星形按钮 + Cmd+Shift+G
│   │   ├── NorthStarOverlay.tsx      # 全屏 overlay 容器（70%屏幕 + 暗化背景）
│   │   ├── ForceGraph.tsx            # D3 力导向图核心（节点/边/物理动画/聚类）
│   │   ├── GraphControls.tsx         # 搜索框 + 筛选器（全部/热路径/模块）
│   │   ├── GraphNodeTooltip.tsx      # 节点 hover/右键菜单
│   │   └── GraphAINarrative.tsx      # 底部/侧边 AI 架构叙事面板
│   │
│   ├── topology/                     # 【重构】拓扑图（Decision 11）
│   │   ├── TopologyView.tsx          # 容器：面包屑 + 图 + AI摘要
│   │   ├── ModuleOverview.tsx        # L3 模块概览（默认视图）
│   │   ├── FileDetailGraph.tsx       # L1 文件级依赖（钻入视图）
│   │   ├── TopologyBreadcrumb.tsx    # 面包屑导航（概览 > 模块 > 文件）
│   │   └── TopologyNodePreview.tsx   # hover 预览（模块→文件数+职责）
│   │
│   ├── challenges/                   # 互动挑战（保留，暂不重构）
│   │   ├── CounterfactualChallenge.tsx
│   │   ├── PersonaJourney.tsx
│   │   └── PredictionChallenge.tsx
│   │
│   └── ui/                           # shadcn 基础组件（保留）
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── input.tsx
│       ├── scroll-area.tsx
│       ├── separator.tsx
│       ├── tabs.tsx
│       ├── textarea.tsx
│       └── tooltip.tsx               # 【新增】用于符号悬停预览
│
├── stores/                           # 【新增】状态管理层（Zustand）
│   ├── workspace-store.ts            # 三面板核心状态（替代 tri-panel-state.tsx）
│   ├── hotpath-store.ts              # 热路径进度状态（Decision 8）
│   ├── navigation-store.ts           # IDE 导航状态（Decision 9a：符号索引/跳转栈/历史）
│   ├── graph-store.ts                # 北极星 + 拓扑图状态（Decision 10/11）
│   └── chat-store.ts                 # 对话状态（消息/会话/Cmd+L 待发送）
│
├── hooks/                            # 【新增】自定义 Hooks
│   ├── use-cmd-l.ts                  # Cmd+L 快捷键监听（Decision 9b）
│   ├── use-keyboard-nav.ts           # IDE 键盘导航（Cmd+Click, F12, Shift+F12, Alt+←/→）
│   ├── use-file-dwell.ts             # 文件停留时间追踪（>30s 标记完成，Decision 8）
│   ├── use-symbol-hover.ts           # 符号悬停预览逻辑
│   └── use-force-graph.ts            # D3 力导向图数据绑定
│
├── lib/                              # ──── 核心库层 ────
│   ├── ai/
│   │   ├── adapters/
│   │   │   ├── deepseek.ts           # DeepSeek 适配器（保留）
│   │   │   ├── doubao.ts             # 豆包适配器（保留）
│   │   │   └── tongyi.ts             # 通义千问适配器（保留）
│   │   ├── factory.ts                # 适配器工厂（保留）
│   │   ├── types.ts                  # AI 类型定义（保留）
│   │   └── prompt/
│   │       ├── context.ts            # 上下文构建（增强：注入热路径进度/符号上下文）
│   │       └── loader.ts             # System Prompt 加载（保留）
│   │
│   ├── analysis/                     # 确定性分析引擎
│   │   ├── import-parser.ts          # 多语言 import 解析（保留）
│   │   ├── call-analyzer.ts          # 函数调用分析（保留）
│   │   ├── graph-builder.ts          # 图构建 + Mermaid 生成（保留）
│   │   ├── hot-path.ts              # 热路径 PageRank（增强：认知依赖排序）
│   │   └── symbol-indexer.ts         # 【新增】文件级符号索引（函数/类型/常量/导出/行号）
│   │
│   ├── github/
│   │   └── client.ts                 # GitHub API 客户端（保留）
│   │
│   ├── conversations/
│   │   ├── types.ts                  # 对话类型（保留）
│   │   └── store.ts                  # 对话存储（保留，后续迁移服务端）
│   │
│   └── utils.ts                      # 通用工具（保留）
│
└── types/                            # 【新增】全局类型定义
    ├── workspace.ts                  # 工作区相关类型
    ├── graph.ts                      # 图/拓扑相关类型
    └── analysis.ts                   # 分析结果类型
```

### 变更摘要

| 类型 | 数量 | 说明 |
|------|------|------|
| **新增目录** | 7 | `stores/`, `hooks/`, `types/`, `components/{layout,home,north-star,topology,file-tree,code-viewer}` |
| **新增文件** | ~30 | 组件拆分 + 状态 store + hooks + 新 API 路由 + 类型 |
| **重构文件** | ~8 | workspace page、FileTree、CodeViewer、ChatInterface、tri-panel-state → Zustand |
| **保留不动** | ~25 | ai adapters、analysis 引擎、github client、shadcn ui、challenges |
| **删除文件** | 2 | `tri-panel-state.tsx`（→ Zustand stores）、`project/chat/page.tsx`（合并至 workspace） |

---

## 三、核心数据模型（TypeScript 类型定义）

### 3.1 工作区核心状态

```typescript
// stores/workspace-store.ts

interface WorkspaceState {
  // ─── 项目信息 ───
  owner: string;
  repo: string;
  repoData: RepoData | null;
  tree: TreeNode[];
  loading: boolean;
  error: string | null;

  // ─── 三面板联动（Decision 7） ───
  activeFile: string | null;
  activeFileContent: string | null;
  highlightedFiles: Record<string, FileStatus>;
  scrollToLine: number | null;
  aiContextFile: string | null;
  selectedCode: CodeSelection | null;
  pendingNavigation: PendingNavigation | null;
  exploredFiles: Set<string>;

  // ─── 面板布局 ───
  sidebarOpen: boolean;
  centerView: 'code' | 'graph';
  sidebarWidth: number;    // 拖拽调宽
  chatPanelWidth: number;  // 拖拽调宽
}

type FileStatus = 'explored' | 'ai-mentioned' | 'hot-path';

interface CodeSelection {
  file: string;
  startLine: number;
  endLine: number;
  text: string;
}

interface PendingNavigation {
  file: string;
  line?: number;
  source: 'ai' | 'tree' | 'code' | 'graph' | 'northstar';
}

interface RepoData {
  name: string;
  fullName: string;
  owner: string;
  description: string | null;
  language: string | null;
  stars: number;
  defaultBranch: string;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: TreeNode[];
}
```

### 3.2 热路径状态（Decision 8）

```typescript
// stores/hotpath-store.ts

interface HotPathState {
  // ─── 热路径数据 ───
  files: HotPathFile[];          // 有序学习路径（①②③...）
  entryPoint: string | null;
  structureSummary: string | null;
  ready: boolean;

  // ─── 学习进度追踪 ───
  currentStep: number;           // 当前正在阅读的序号（0-based）
  completed: Set<string>;        // 已完成文件路径集合
  dwellTimers: Map<string, number>; // 文件→累计停留秒数

  // ─── 计算属性 ───
  readonly progress: { current: number; total: number };
  readonly nextFile: string | null;
  readonly isAllComplete: boolean;
}

interface HotPathFile {
  path: string;
  score: number;           // PageRank 分数
  rank: number;            // 学习顺序序号（1-based）
  inDegree: number;
  outDegree: number;
  reason: string;
  cognitivePrereqs: string[];  // 认知前置依赖（"先看 A 才能懂 B"）
}
```

### 3.3 IDE 导航状态（Decision 9a）

```typescript
// stores/navigation-store.ts

interface NavigationState {
  // ─── 符号索引 ───
  symbolIndex: Map<string, SymbolInfo[]>;  // filePath → symbols
  symbolLoading: Set<string>;              // 正在加载符号的文件

  // ─── 跳转历史栈 ───
  navigationStack: NavigationEntry[];
  stackCursor: number;                      // 当前位置（支持前进/后退）

  // ─── 符号大纲 ───
  outlineVisible: boolean;
  outlineWidth: number;
}

interface SymbolInfo {
  name: string;
  kind: 'function' | 'class' | 'type' | 'interface' | 'constant' | 'variable' | 'method' | 'enum';
  line: number;
  endLine?: number;
  exported: boolean;
  signature?: string;         // 函数签名
  comment?: string;           // JSDoc / 注释
  referenceCount?: number;    // 被引用次数
  isHotPath?: boolean;        // 是否属于热路径
}

interface NavigationEntry {
  file: string;
  line: number;
  symbol?: string;
  timestamp: number;
}

// API Response: /api/github/symbols
interface SymbolIndexResponse {
  path: string;
  symbols: SymbolInfo[];
  imports: ImportInfo[];
  exports: ExportInfo[];
}

// API Response: /api/github/references
interface ReferencesResponse {
  symbol: string;
  definedIn: { file: string; line: number };
  references: Array<{
    file: string;
    line: number;
    context: string;   // 引用行上下文（前后各1行）
  }>;
}
```

### 3.4 北极星图状态（Decision 10）

```typescript
// stores/graph-store.ts

interface GraphState {
  // ─── 北极星 overlay ───
  northStarOpen: boolean;
  northStarCenter: string | null;     // 当前中心文件
  graphFilter: 'all' | 'hotpath' | 'module';
  graphData: ProjectGraph | null;
  graphLoading: boolean;

  // ─── 拓扑图（Decision 11）───
  topoLevel: 'L3' | 'L1';
  topoFocusModule: string | null;
  topoBreadcrumb: string[];
}

interface ProjectGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: GraphCluster[];
}

interface GraphNode {
  id: string;              // file path
  label: string;           // file name
  type: 'file';
  module: string;          // 所属模块（目录名）
  metrics: {
    pageRank: number;
    inDegree: number;
    outDegree: number;
  };
  isHotPath: boolean;
  hotPathRank?: number;    // 热路径序号
  isCompleted: boolean;    // 学习已完成
}

interface GraphEdge {
  source: string;          // 源文件路径
  target: string;          // 目标文件路径
  weight: number;          // 依赖权重（引用符号数量）
  isHotPathEdge: boolean;  // 是否属于热路径连线
}

interface GraphCluster {
  id: string;              // 目录路径
  label: string;           // 目录名
  nodeIds: string[];       // 包含的文件
  color: string;           // 聚类背景色
}
```

### 3.5 对话状态（Cmd+L 集成）

```typescript
// stores/chat-store.ts

interface ChatState {
  // ─── 当前对话 ───
  conversationId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  input: string;

  // ─── Cmd+L 待发送（Decision 9b）───
  pendingCodeToAI: PendingCodeSnippet | null;

  // ─── 对话管理 ───
  conversations: ConversationMeta[];
  showHistory: boolean;
  parentConv: ConversationMeta | null;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** 消息来源标记 */
  source?: 'manual' | 'cmd-l' | 'code-select' | 'hotpath-auto' | 'proactive';
}

interface PendingCodeSnippet {
  file: string;
  startLine: number;
  endLine: number;
  text: string;
  /** Cmd+L 发送时自动填入的提示 */
  suggestedPrompt?: string;
}

interface ConversationMeta {
  id: string;
  title: string;
  parentId: string | null;
  messageCount: number;
  updatedAt: number;
}
```

### 3.6 AI 分析结果类型（文件摘要 / 区域标注）

```typescript
// types/analysis.ts

/** 9c: 文件摘要卡片数据 */
interface FileSummary {
  path: string;
  /** AI 生成的角色定位 */
  role: string;                    // e.g. "HTTP 路由注册中心"
  /** 确定性分析的能力标签 */
  tags: string[];                  // e.g. ["导出 12 个函数", "被 8 个文件引用"]
  /** 引用统计 */
  stats: {
    exports: number;
    imports: number;
    referencedBy: number;
    references: number;
    lines: number;
  };
  /** AI 洞察（流式追加） */
  aiInsight?: string;
}

/** 9c: 代码区域标注 */
interface RegionAnnotation {
  startLine: number;
  endLine: number;
  type: 'core-logic' | 'interface' | 'export-entry' | 'config' | 'error-handling';
  color: string;                   // 橙/蓝/绿/灰/红
  label: string;                   // 简短标签
  aiExplanation?: string;          // 展开后的 AI 说明（2-3行）
}
```

---

## 四、页面路由结构

| 路由 | 类型 | 说明 | 变更 |
|------|------|------|------|
| `/` | 页面 | 首页：GitHub URL 输入 + 功能展示 + 推荐项目 | 拆分组件，页面瘦身 |
| `/project/new` | 页面 | 项目初始化：分析流水线可视化 → 跳转 workspace | 保留 |
| `/workspace/[owner]/[repo]` | 布局+页面 | **核心**：三面板工作区 | **新增 layout.tsx**，页面瘦身 |
| `/settings` | 页面 | AI 提供者配置 | 保留 |
| `/api/chat` | API | SSE 流式 AI 对话 | 增强上下文（热路径进度/符号） |
| `/api/providers` | API | 可用 AI 提供者列表 | 保留 |
| `/api/github/repo` | API | 仓库元信息 + README | 保留 |
| `/api/github/tree` | API | 文件树 | 保留 |
| `/api/github/file` | API | 文件内容 | 保留 |
| `/api/github/hotpath` | API | 热路径分析 | 增强：返回认知排序 |
| `/api/github/dependencies` | API | 依赖图（三层） | 保留 |
| `/api/github/symbols` | API | **新增**：文件符号索引 | Decision 9a |
| `/api/github/references` | API | **新增**：符号引用查找 | Decision 9a |

### 删除的路由

| 路由 | 原因 |
|------|------|
| `/project/chat` | 功能与 workspace 重复，无独立存在价值 |

---

## 五、组件拆分方案（组件树）

### 5.1 组件分类

```
📦 页面组件 (Page)        → app/*/page.tsx, 只负责组装，不含业务逻辑
📐 布局组件 (Layout)      → components/layout/, 结构性容器
🔧 业务组件 (Feature)     → components/{file-tree,code-viewer,chat,north-star,topology,home}/
🧱 通用组件 (UI)          → components/ui/, shadcn 原子组件
```

### 5.2 工作区组件树

```
WorkspacePage (页面组件)
├── WorkspaceTopBar (布局)
│   ├── SidebarToggle
│   ├── RepoBreadcrumb (owner/repo + language badge + stars)
│   └── NorthStarButton ← 【新增 Decision 10】右上角常驻
│
└── WorkspaceShell (布局：三面板容器 + 拖拽分隔线)
    │
    ├── [LEFT] FileTreePanel
    │   ├── HotPathProgressBar ← 【新增 Decision 8】顶部固定
    │   ├── FileSearchInput
    │   └── FileTree
    │       └── FileTreeNode (递归)
    │           ├── HotPathBadge ← 【新增 Decision 8】序号①②③
    │           └── FileStatusIndicator
    │
    ├── [CENTER] CenterPanel
    │   ├── ViewToggleBar (代码 | 拓扑图)
    │   │
    │   ├── [code view] CodeViewer
    │   │   ├── FileSummaryCard ← 【新增 Decision 9c】可折叠
    │   │   ├── NavigationBreadcrumb ← 【新增 Decision 9a】Alt+←/→
    │   │   ├── SymbolOutline (左侧折叠栏) ← 【新增 Decision 9a】
    │   │   ├── CodeContent (主代码区)
    │   │   │   ├── RegionAnnotation (gutter) ← 【新增 Decision 9c】
    │   │   │   └── HoverPreview (tooltip) ← 【新增 Decision 9a】
    │   │   └── SelectionActionBar (浮动) ← 增强：含 Cmd+L
    │   │
    │   └── [graph view] TopologyView ← 【重构 Decision 11】
    │       ├── TopologyBreadcrumb
    │       ├── ModuleOverview (L3 默认)
    │       ├── FileDetailGraph (L1 钻入)
    │       └── TopologyNodePreview (hover)
    │
    └── [RIGHT] ChatPanel
        ├── ChatTopBar (历史/子对话 按钮)
        ├── ChatHistory (overlay)
        ├── ChatMessageList
        │   └── ChatMessage
        │       └── MessageContent (Markdown + Mermaid + CodeBlock)
        └── ChatInput (Textarea + 操作按钮)

[OVERLAY] NorthStarOverlay ← 【新增 Decision 10】
├── ForceGraph (D3 力导向图核心)
├── GraphControls (搜索 + 筛选)
├── GraphNodeTooltip (hover/右键)
└── GraphAINarrative (AI 架构叙事)
```

### 5.3 组件职责边界

| 组件 | 职责 | 数据来源 | 不做什么 |
|------|------|---------|---------|
| `WorkspaceShell` | 三面板分栏 + 拖拽调宽 | props: sidebarOpen, widths | 不做业务逻辑 |
| `FileTree` | 渲染文件树 + 搜索过滤 | store: workspace, hotpath | 不做 API 调用 |
| `HotPathProgressBar` | 进度展示 + "下一步"按钮 | store: hotpath | 不做进度计算 |
| `CodeViewer` | 组装代码区子组件 | store: workspace, navigation | 不直接渲染代码 |
| `CodeContent` | Shiki 语法高亮 + 行号 + gutter | props: code, language, annotations | 不做符号解析 |
| `SymbolOutline` | 符号列表 + 点击跳转 | store: navigation (symbolIndex) | 不做 API 调用 |
| `ChatPanel` | 组装对话子组件 | store: chat | 不做消息渲染 |
| `ForceGraph` | D3 力导向图渲染 + 交互 | store: graph (graphData) | 不做数据获取 |

---

## 六、状态管理方案

### 6.1 技术选型：useReducer+Context → Zustand

| 维度 | 当前（useReducer+Context） | 重构（Zustand） |
|------|--------------------------|----------------|
| 代码量 | 243 行（仅基础功能） | 每个 store ~80-120 行 |
| 性能 | 任何状态变更 → 所有消费组件重渲染 | selector 精准订阅，最小化重渲染 |
| 跨组件访问 | 必须在 Provider 内 | 任何位置直接 import |
| DevTools | 无 | 内置支持 |
| 中间件 | 手写 | persist / immer / devtools 开箱即用 |

### 6.2 Store 拆分原则

```
┌─────────────────┐
│  workspace-store │ ← 三面板联动基础（activeFile, tree, layout）
│  (全局)          │    所有面板读写
└───────┬─────────┘
        │ 依赖
┌───────┴─────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  hotpath-store  │  │ nav-store    │  │ graph-store  │  │ chat-store   │
│  (全局)         │  │ (全局)       │  │ (全局)       │  │ (全局)       │
│  Decision 8     │  │ Decision 9a  │  │ Decision 10/11│ │ Decision 9b  │
│                 │  │              │  │              │  │              │
│ - 热路径进度    │  │ - 符号索引   │  │ - 北极星图   │  │ - 消息列表   │
│ - 停留时间      │  │ - 跳转栈     │  │ - 拓扑层级   │  │ - Cmd+L 待发 │
│ - 完成追踪      │  │ - 面包屑     │  │ - 图数据     │  │ - 流式状态   │
└─────────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

### 6.3 全局 vs 局部

| 数据 | 管理方式 | 原因 |
|------|---------|------|
| activeFile / tree / repoData | **全局** workspace-store | 三面板+北极星+拓扑 都需要 |
| hotPath files / progress | **全局** hotpath-store | FileTree + AI + 北极星 都需要 |
| symbolIndex / navStack | **全局** navigation-store | CodeViewer + 北极星 都需要 |
| graphData / northStarOpen | **全局** graph-store | 北极星 overlay + 拓扑 + AI |
| messages / streaming | **全局** chat-store | ChatPanel + Cmd+L hook |
| 文件搜索关键词 | **局部** useState | 仅 FileTree 内部 |
| 选中代码浮动条位置 | **局部** useState | 仅 CodeContent 内部 |
| 对话输入框内容 | **全局** chat-store.input | Cmd+L 需要写入 |
| 拓扑面包屑 | **全局** graph-store | TopologyView + 北极星 |
| sidebar/panel 宽度 | **全局** workspace-store + persist | 用户偏好持久化 |

### 6.4 Store 交互规则

```
1. 单向数据流：Action → Store → UI
2. 跨 store 联动通过 subscribe：
   - workspace.activeFile 变化 → navigation-store 加载符号索引
   - workspace.activeFile 变化 → chat-store 更新 AI 上下文
   - hotpath-store.completed 变化 → graph-store 更新节点颜色
   - chat-store.messages 变化 → workspace.highlightedFiles 更新（AI 提及文件）
3. API 调用在组件 useEffect 或 store action 中发起，结果写入 store
4. 联动延迟 <100ms（Decision 7 硬约束）
```

---

## 七、API 接口契约

### 7.1 新增接口

#### `GET /api/github/symbols`

文件级符号索引，支持 Decision 9a 的跳转定义、符号大纲、悬停预览。

```typescript
// Request
GET /api/github/symbols?owner=go-chi&repo=chi&path=mux.go

// Response 200
{
  "path": "mux.go",
  "language": "go",
  "symbols": [
    {
      "name": "Mux",
      "kind": "type",
      "line": 23,
      "endLine": 45,
      "exported": true,
      "signature": "type Mux struct { ... }",
      "comment": "Mux is a simple HTTP route multiplexer...",
      "referenceCount": 12
    },
    {
      "name": "NewMux",
      "kind": "function",
      "line": 48,
      "endLine": 62,
      "exported": true,
      "signature": "func NewMux() *Mux",
      "comment": "NewMux returns a newly initialized Mux object",
      "referenceCount": 8
    }
    // ...
  ],
  "imports": [
    { "path": "net/http", "alias": null },
    { "path": "./middleware", "resolved": "middleware/middleware.go" }
  ],
  "exports": [
    { "name": "Mux", "kind": "type", "line": 23 },
    { "name": "NewMux", "kind": "function", "line": 48 }
  ]
}
```

**实现**：基于 `call-analyzer.ts` 的正则提取扩展，增加行号/签名/注释提取。精度目标 >90%，不需 LSP。

#### `GET /api/github/references`

跨文件符号引用查找，支持 Decision 9a 的"查看引用"。

```typescript
// Request
GET /api/github/references?owner=go-chi&repo=chi&symbol=NewMux&file=mux.go

// Response 200
{
  "symbol": "NewMux",
  "definedIn": { "file": "mux.go", "line": 48 },
  "references": [
    {
      "file": "chi.go",
      "line": 15,
      "context": "r := chi.NewMux()"
    },
    {
      "file": "server/server.go",
      "line": 32,
      "context": "mux := NewMux()"
    }
  ],
  "totalCount": 2
}
```

**实现**：在 `symbol-indexer.ts` 中，对目标 symbol 做全局 grep（正则匹配调用位置），返回文件+行号+上下文。

### 7.2 增强接口

#### `GET /api/github/hotpath`（增强）

```typescript
// Response 200 (增强字段标记 ★)
{
  "files": [
    {
      "path": "mux.go",
      "score": 0.087,
      "rank": 1,                          // ★ 学习顺序序号
      "inDegree": 12,
      "outDegree": 3,
      "reason": "核心路由复用器",
      "cognitivePrereqs": []              // ★ 认知前置依赖
    },
    {
      "path": "tree.go",
      "score": 0.065,
      "rank": 2,
      "inDegree": 8,
      "outDegree": 2,
      "reason": "路由树匹配引擎",
      "cognitivePrereqs": ["mux.go"]     // ★ 先看 mux.go 才能懂
    }
  ],
  "entryPoint": "mux.go",
  "structureSummary": "...",
  "totalFiles": 8                         // ★ 热路径文件总数
}
```

#### `POST /api/chat`（增强上下文）

```typescript
// Request Body (增强字段标记 ★)
{
  "messages": [...],
  "context": {
    "projectName": "go-chi/chi",
    "projectDescription": "...",
    "currentFile": "mux.go",
    "fileContent": "...",
    "analysisResults": "...",
    "hotPathProgress": {                 // ★ 热路径学习进度
      "currentStep": 3,
      "totalSteps": 8,
      "completedFiles": ["mux.go", "tree.go", "context.go"],
      "currentFile": "middleware.go"
    },
    "symbolContext": {                   // ★ 当前文件符号上下文
      "symbols": [...],
      "selectedSymbol": "Use"
    }
  }
}
```

### 7.3 保留不变的接口

| 接口 | 说明 |
|------|------|
| `GET /api/github/repo` | 仓库元信息 |
| `GET /api/github/tree` | 文件树 |
| `GET /api/github/file` | 文件内容 |
| `GET /api/github/dependencies` | 依赖图（三层） |
| `GET /api/providers` | AI 提供者列表 |

---

## 八、键盘快捷键规格

| 快捷键 | 作用域 | 行为 | 决策 |
|--------|--------|------|------|
| `Cmd+L` / `Ctrl+L` | 全局 | 选中代码→填入 AI 输入框；无选中→聚焦 AI 输入框 | 9b |
| `Cmd+Click` / `F12` | 代码区 | 跳转定义（本文件滚动/跨文件三面板联动） | 9a |
| `Shift+F12` | 代码区 | 查看引用列表 | 9a |
| `Alt+←` / `Alt+→` | 全局 | 导航历史前进/后退 | 9a |
| `Cmd+Shift+G` | 全局 | 打开/关闭北极星图 | 10 |
| `Escape` | 北极星 overlay | 关闭 overlay | 10 |

---

## 九、新增依赖

| 包 | 版本 | 用途 | 决策 |
|----|------|------|------|
| `zustand` | ^5.x | 状态管理（替代 useReducer+Context） | 全局 |
| `d3-force` + `d3-selection` + `d3-zoom` | ^3.x / ^3.x / ^3.x | 北极星力导向图 | 10 |
| `immer` | ^10.x | Zustand 中间件，简化不可变更新 | 全局 |

> **不引入**：react-force-graph（过重）、@antv/g6（生态不匹配）、mobx（与 Zustand 冲突）

---

## 十、实施路线图（阶段二起步顺序）

```
Phase 2: 骨架搭建
├── 2.1 安装新依赖（zustand, d3-force, immer）
├── 2.2 创建 stores/ 目录 + 5 个 store 骨架
├── 2.3 创建 components/layout/ 布局组件
├── 2.4 拆分 workspace page → layout.tsx + page.tsx
├── 2.5 拆分首页组件
├── 2.6 所有新组件占位实现
└── 2.7 验证导航流完整可用

Phase 3: 逐功能实现（每次一个，循环验收）
├── 3.1 Zustand store 迁移（替换 tri-panel-state）
├── 3.2 FileTree 热路径序号导航（Decision 8）
├── 3.3 CodeViewer 符号大纲 + 跳转定义（Decision 9a）
├── 3.4 Cmd+L 快捷键（Decision 9b）
├── 3.5 AI 主动分析层：文件摘要 + 区域标注（Decision 9c）
├── 3.6 北极星力导向图（Decision 10）
├── 3.7 拓扑图层级钻入（Decision 11）
└── 3.8 新 API 路由实现（symbols / references）

Phase 4: UI/UX 打磨
├── 4.1 动画/过渡效果
├── 4.2 骨架屏/加载状态
├── 4.3 错误处理完善
└── 4.4 响应式适配
```

---

> **此文档为阶段一输出，仅包含设计方案，不含实现代码。请验收后进入阶段二。**
