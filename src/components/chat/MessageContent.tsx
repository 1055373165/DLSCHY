"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MermaidRenderer } from "./MermaidRenderer";
import { CodeBlock } from "./CodeBlock";
import { hasStructuredBlocks, parseContentBlocks } from "@/lib/content/block-parser";
import { PredictionChallenge, type PredictionChallengeData } from "@/components/challenge/PredictionChallenge";
import { JourneyNarrative, type JourneyNarrativeData } from "@/components/narrative/JourneyNarrative";
import { DialogueFormat, type DialogueFormatData } from "@/components/narrative/DialogueFormat";
import { ComparisonFormat, type ComparisonFormatData } from "@/components/narrative/ComparisonFormat";
import { CounterfactualChallenge, type CounterfactualChallengeData } from "@/components/challenge/CounterfactualChallenge";
import { ArchaeologyChallenge, type ArchaeologyChallengeData } from "@/components/challenge/ArchaeologyChallenge";
import type { Components } from "react-markdown";

interface MessageContentProps {
  content: string;
  onFileNavigate?: (path: string) => void;
}

function looksLikeFilePath(text: string): boolean {
  if (!text || text.length < 3) return false;
  // Must contain a slash and look like a relative path
  if (!text.includes("/")) return false;
  // Filter out URLs
  if (text.startsWith("http") || text.startsWith("//")) return false;
  // Filter out common non-path patterns
  if (text.includes(" ")) return false;
  // Should look like a directory or file path
  return /^[a-zA-Z0-9_.\-\/]+\/?$/.test(text);
}

export function MessageContent({ content, onFileNavigate }: MessageContentProps) {
  const components: Components = {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "");
      const language = match ? match[1] : undefined;
      const codeString = String(children).replace(/\n$/, "");

      // Check if this is an inline code (no language, short content)
      const isInline = !className && !codeString.includes("\n");

      if (isInline) {
        // Detect file paths and make them clickable
        if (onFileNavigate && looksLikeFilePath(codeString)) {
          return (
            <code
              role="button"
              tabIndex={0}
              onClick={() => onFileNavigate(codeString.replace(/\/$/, ""))}
              onKeyDown={(e) => e.key === "Enter" && onFileNavigate(codeString.replace(/\/$/, ""))}
              className="cursor-pointer rounded bg-indigo-50 px-1.5 py-0.5 text-sm font-mono text-indigo-700 underline decoration-indigo-300 decoration-dashed underline-offset-2 transition-colors hover:bg-indigo-100 hover:text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300 dark:decoration-indigo-700 dark:hover:bg-indigo-900/40"
              title={`点击查看: ${codeString}`}
            >
              {children}
            </code>
          );
        }
        return (
          <code
            className="rounded bg-slate-100 px-1.5 py-0.5 text-sm font-mono text-indigo-700 dark:bg-slate-800 dark:text-indigo-300"
            {...props}
          >
            {children}
          </code>
        );
      }

      // Mermaid code blocks
      if (language === "mermaid") {
        return <MermaidRenderer chart={codeString} />;
      }

      // Regular code blocks
      return <CodeBlock code={codeString} language={language} />;
    },
    // Style headings within chat messages
    h1({ children }) {
      return (
        <h1 className="mb-3 mt-6 text-xl font-bold text-slate-900 first:mt-0 dark:text-white">
          {children}
        </h1>
      );
    },
    h2({ children }) {
      return (
        <h2 className="mb-2 mt-5 text-lg font-semibold text-slate-900 first:mt-0 dark:text-white">
          {children}
        </h2>
      );
    },
    h3({ children }) {
      return (
        <h3 className="mb-2 mt-4 text-base font-semibold text-slate-900 first:mt-0 dark:text-white">
          {children}
        </h3>
      );
    },
    p({ children }) {
      return (
        <p className="mb-3 leading-relaxed text-slate-700 last:mb-0 dark:text-slate-300">
          {children}
        </p>
      );
    },
    ul({ children }) {
      return <ul className="mb-3 ml-4 list-disc space-y-1">{children}</ul>;
    },
    ol({ children }) {
      return <ol className="mb-3 ml-4 list-decimal space-y-1">{children}</ol>;
    },
    li({ children }) {
      return (
        <li className="text-slate-700 dark:text-slate-300">{children}</li>
      );
    },
    blockquote({ children }) {
      return (
        <blockquote className="my-3 border-l-4 border-indigo-300 bg-indigo-50/50 py-2 pl-4 text-slate-600 dark:border-indigo-700 dark:bg-indigo-950/20 dark:text-slate-400">
          {children}
        </blockquote>
      );
    },
    table({ children }) {
      return (
        <div className="my-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="min-w-full text-sm">{children}</table>
        </div>
      );
    },
    thead({ children }) {
      return (
        <thead className="bg-slate-50 dark:bg-slate-800/50">{children}</thead>
      );
    },
    th({ children }) {
      return (
        <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">
          {children}
        </th>
      );
    },
    td({ children }) {
      return (
        <td className="border-t border-slate-200 px-3 py-2 text-slate-600 dark:border-slate-700 dark:text-slate-400">
          {children}
        </td>
      );
    },
    strong({ children }) {
      return (
        <strong className="font-semibold text-slate-900 dark:text-white">
          {children}
        </strong>
      );
    },
    a({ href, children }) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-800 dark:text-indigo-400 dark:decoration-indigo-700"
        >
          {children}
        </a>
      );
    },
    hr() {
      return <hr className="my-4 border-slate-200 dark:border-slate-700" />;
    },
  };

  const segments = useMemo(() => {
    if (!hasStructuredBlocks(content)) return null;
    return parseContentBlocks(content);
  }, [content]);

  // If no structured blocks, render plain markdown (fast path)
  if (!segments) {
    return (
      <div className="prose-sm max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {content}
        </ReactMarkdown>
      </div>
    );
  }

  // Render mixed content: text segments as markdown, blocks as rich components
  return (
    <div className="prose-sm max-w-none">
      {segments.map((seg, i) => {
        if (seg.type === "text" && seg.content) {
          return (
            <ReactMarkdown key={i} remarkPlugins={[remarkGfm]} components={components}>
              {seg.content}
            </ReactMarkdown>
          );
        }
        if (seg.type === "block" && seg.block) {
          const { block } = seg;
          switch (block.type) {
            case "prediction":
              return (
                <PredictionChallenge
                  key={i}
                  data={{ id: `challenge-${i}`, ...block.data as Omit<PredictionChallengeData, "id"> }}
                />
              );
            case "journey":
              return <JourneyNarrative key={i} data={block.data as JourneyNarrativeData} />;
            case "dialogue":
              return <DialogueFormat key={i} data={block.data as DialogueFormatData} />;
            case "comparison":
              return <ComparisonFormat key={i} data={block.data as ComparisonFormatData} />;
            case "counterfactual":
              return (
                <CounterfactualChallenge
                  key={i}
                  data={{ id: `counterfactual-${i}`, ...block.data as Omit<CounterfactualChallengeData, "id"> }}
                />
              );
            case "archaeology":
              return (
                <ArchaeologyChallenge
                  key={i}
                  data={{ id: `archaeology-${i}`, ...block.data as Omit<ArchaeologyChallengeData, "id"> }}
                />
              );
            default:
              return null;
          }
        }
        return null;
      })}
    </div>
  );
}
