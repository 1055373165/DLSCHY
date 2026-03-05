"use client";

import { MessageSquare } from "lucide-react";

/**
 * DialogueFormat — Phase 6a narrative renderer.
 * Renders component-to-component dialogue with technical annotations.
 */

export interface DialogueSpeaker {
  name: string;
  lines: string[];
}

export interface DialogueFormatData {
  speakers: DialogueSpeaker[];
  annotation?: string;
}

interface Props {
  data: DialogueFormatData;
}

const SPEAKER_COLORS = [
  { bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800", text: "text-blue-700 dark:text-blue-300", badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  { bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-300", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  { bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-300", badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  { bg: "bg-rose-50 dark:bg-rose-950/30", border: "border-rose-200 dark:border-rose-800", text: "text-rose-700 dark:text-rose-300", badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
];

export function DialogueFormat({ data }: Props) {
  // Interleave lines from speakers into a conversation flow
  const lines: { speaker: DialogueSpeaker; line: string; colorIndex: number }[] = [];
  const maxLines = Math.max(...data.speakers.map((s) => s.lines.length));

  for (let i = 0; i < maxLines; i++) {
    for (let j = 0; j < data.speakers.length; j++) {
      if (i < data.speakers[j].lines.length) {
        lines.push({
          speaker: data.speakers[j],
          line: data.speakers[j].lines[i],
          colorIndex: j % SPEAKER_COLORS.length,
        });
      }
    }
  }

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-teal-200 dark:border-teal-800">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-teal-100 bg-teal-50/50 px-4 py-2.5 dark:border-teal-900 dark:bg-teal-950/40">
        <MessageSquare className="h-4 w-4 text-teal-500" />
        <span className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">
          组件对话
        </span>
        <div className="ml-auto flex gap-1.5">
          {data.speakers.map((s, i) => (
            <span
              key={i}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${SPEAKER_COLORS[i % SPEAKER_COLORS.length].badge}`}
            >
              {s.name}
            </span>
          ))}
        </div>
      </div>

      {/* Conversation */}
      <div className="space-y-2 p-4">
        {lines.map((entry, i) => {
          const colors = SPEAKER_COLORS[entry.colorIndex];
          return (
            <div key={i} className={`rounded-lg border ${colors.border} ${colors.bg} p-3`}>
              <span className={`text-xs font-semibold ${colors.text}`}>
                {entry.speaker.name}:
              </span>
              <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {entry.line}
              </p>
            </div>
          );
        })}
      </div>

      {/* Technical annotation */}
      {data.annotation && (
        <div className="border-t border-teal-100 bg-slate-50 px-4 py-3 dark:border-teal-900 dark:bg-slate-900/50">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            技术注释
          </p>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            {data.annotation}
          </p>
        </div>
      )}
    </div>
  );
}
