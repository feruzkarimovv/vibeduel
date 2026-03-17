'use client';

import { useEffect, useRef } from 'react';

type CodeEditorProps = {
  readonly code: string;
  readonly onChange: (code: string) => void;
  readonly isStreaming?: boolean;
  readonly readOnly?: boolean;
};

export default function CodeEditor({
  code,
  onChange,
  isStreaming = false,
  readOnly = false,
}: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom while streaming
  useEffect(() => {
    if (isStreaming && textareaRef.current) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [code, isStreaming]);

  const lineCount = code ? code.split('\n').length : 0;
  const charCount = code.length;
  const lineNumbers = Array.from({ length: Math.max(lineCount, 1) }, (_, i) =>
    String(i + 1),
  );

  return (
    <div className="flex flex-col h-full border border-arena-line bg-arena-dark overflow-hidden">
      {/* Editor header */}
      <div className="flex items-center justify-between px-4 py-2 bg-arena-mid/50 border-b border-arena-line">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-neon-green animate-pulse" />
          <span className="text-[10px] text-zinc-600 font-mono uppercase tracking-wider">
            Editor
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-zinc-600 font-mono">App.js</span>
          {isStreaming && (
            <span className="flex items-center gap-1.5 text-[10px] text-neon-green font-mono">
              <span className="w-1.5 h-1.5 bg-neon-green animate-pulse" />
              STREAMING
            </span>
          )}
        </div>
        <div className="text-[10px] text-zinc-700 tabular-nums font-mono">
          {lineCount} ln &middot; {charCount.toLocaleString()} ch
        </div>
      </div>

      {/* Editor body with line numbers */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* Line numbers */}
        <div
          className="flex-shrink-0 py-4 px-2 text-right select-none overflow-hidden bg-arena-black/50 border-r border-arena-line"
          aria-hidden="true"
        >
          {lineNumbers.map((num) => (
            <div
              key={num}
              className="text-[11px] leading-[1.65rem] text-zinc-800 font-mono"
            >
              {num}
            </div>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => onChange(e.target.value)}
          readOnly={readOnly || isStreaming}
          spellCheck={false}
          className="flex-1 w-full h-full min-h-[300px] py-4 px-4 bg-transparent text-zinc-300 font-mono text-sm leading-[1.65rem] resize-none focus:outline-none placeholder:text-zinc-800 overflow-auto"
          placeholder={
            isStreaming
              ? '// AI is generating code...'
              : '// Your code will appear here after you generate...'
          }
        />

        {/* Streaming cursor effect */}
        {isStreaming && code.length > 0 && (
          <div className="absolute bottom-4 right-4 flex items-center gap-1.5 px-2 py-1 border border-neon-green/30 bg-arena-dark">
            <div className="w-1.5 h-4 bg-neon-green animate-[blink_1s_ease-in-out_infinite]" />
            <span className="text-[10px] text-neon-green font-mono uppercase">
              generating
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
