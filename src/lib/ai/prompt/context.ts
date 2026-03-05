/**
 * 上下文注入模块
 * 根据用户当前学习状态，构建发送给 AI 的上下文信息
 */

import type { ChatMessage } from "../types";
import { loadSystemPrompt } from "./loader";

export interface LearningContext {
  projectName: string;
  projectDescription?: string;
  currentModule?: string;
  currentFile?: string;
  fileContent?: string;
  exploredModules?: string[];
  learningGoal?: string;
  analysisResults?: string;
  viewMode?: 'guided' | 'expert';
}

const STRUCTURED_BLOCK_INSTRUCTIONS = `**富媒体输出格式：** 在合适的时机，你可以使用以下特殊格式块来增强学习体验。这些块会被前端渲染为交互式组件。

1. **预测挑战**（当讲解设计决策时，先让用户猜测）：
:::prediction
{"question":"这个模块为什么选择了X方案？","context":"相关代码片段或背景","options":["选项A","选项B","选项C","选项D"],"answerIndex":2,"explanation":"详细解释为什么答案是C...","hint":"可选提示"}
:::

2. **旅程叙事**（用第一人称视角讲解模块职责）：
:::journey
{"narrator":"模块名称","narrative":"我是XXX模块，我的职责是...当一个请求到来时，我会...","technical":"XXX模块负责处理...它通过...实现了..."}
:::

3. **组件对话**（用对话形式展示模块间协作）：
:::dialogue
{"speakers":[{"name":"Router","lines":["我收到了一个请求...","好的，我把结果返回给客户端"]},{"name":"Handler","lines":["收到，我来处理这个请求...","处理完成，结果是..."]}],"annotation":"技术注释：Router和Handler通过...协作"}
:::

4. **方案对比**（对比不同设计方案的优劣）：
:::comparison
{"title":"状态管理方案对比","schemes":[{"name":"方案A","pros":["优势1","优势2"],"cons":["劣势1"]},{"name":"方案B","pros":["优势1"],"cons":["劣势1","劣势2"]}]}
:::

5. **反事实推理**（探讨"如果不这样设计会怎样"）：
:::counterfactual
{"scenario":"如果Router不使用中间件模式...","currentDesign":"中间件模式","alternatives":[{"name":"硬编码路由","consequence":"每次新增路由都需要修改核心代码..."},{"name":"配置文件路由","consequence":"灵活性提高但缺少类型安全..."}],"insight":"中间件模式在灵活性和类型安全之间取得了平衡..."}
:::

6. **代码考古**（展示新旧两版代码，让用户分析重构原因）：
:::archaeology
{"title":"Router重构","before":"// v1\\napp.get('/users', handler1);","after":"// v2\\nconst routes = loadRoutes();\\nroutes.forEach(r => app[r.method](r.path, r.handler));","question":"这次重构的主要目的是什么？","options":["提高性能","提高可维护性","修复安全漏洞","减少代码量"],"answerIndex":1,"explanation":"重构将硬编码路由改为动态加载，提高了可维护性..."}
:::

注意：每条消息最多使用1-2个特殊块，不要过度使用。JSON必须是合法的单行或多行JSON。在讲解架构、设计决策、模块协作时优先考虑使用这些格式。`;

export function buildSystemMessage(context?: LearningContext): ChatMessage {
  let systemContent = loadSystemPrompt();

  if (context) {
    const contextBlock = buildContextBlock(context);
    systemContent += "\n\n---\n\n" + contextBlock;
  }

  return {
    role: "system",
    content: systemContent,
  };
}

function buildContextBlock(context: LearningContext): string {
  const parts: string[] = [];

  parts.push(`# 当前学习上下文`);
  parts.push(`**项目：** ${context.projectName}`);

  if (context.projectDescription) {
    parts.push(`**项目描述：** ${context.projectDescription}`);
  }

  if (context.currentModule) {
    parts.push(`**当前聚焦模块：** ${context.currentModule}`);
  }

  if (context.currentFile) {
    parts.push(`**当前查看文件：** ${context.currentFile}`);
  }

  if (context.fileContent) {
    const MAX_FILE_CHARS = 12000;
    const truncated =
      context.fileContent.length > MAX_FILE_CHARS
        ? context.fileContent.slice(0, MAX_FILE_CHARS) +
          `\n... [文件已截断，共 ${context.fileContent.length} 字符]`
        : context.fileContent;
    parts.push(`**文件内容：**\n\`\`\`\n${truncated}\n\`\`\``);
  }

  if (context.exploredModules && context.exploredModules.length > 0) {
    parts.push(
      `**已探索模块：** ${context.exploredModules.join(", ")}`
    );
  }

  if (context.learningGoal) {
    parts.push(`**用户学习目标：** ${context.learningGoal}`);
  }

  if (context.analysisResults) {
    parts.push(
      `**已有分析结果：**\n${context.analysisResults}`
    );
  }

  if (context.viewMode === 'expert') {
    parts.push(
      `**输出模式：** 专家模式。请简洁回答，直接给出代码和关键点，避免长篇大论的解释和比较。使用代码注释而不是长篇大段的文字。`
    );
  } else {
    parts.push(
      `**输出模式：** 辅导模式。请提供详细解释，使用类比和比较辅助理解，描述实现和设计的关键步骤和决策过程。`
    );
  }

  parts.push(STRUCTURED_BLOCK_INSTRUCTIONS);

  return parts.join("\n\n");
}
