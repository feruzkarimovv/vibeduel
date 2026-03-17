'use client';

import { useState, useCallback, KeyboardEvent } from 'react';

type PromptBarProps = {
  readonly onGenerate: (prompt: string) => void;
  readonly isGenerating: boolean;
  readonly iterationCount: number;
  readonly maxIterations: number;
  readonly disabled?: boolean;
};

export default function PromptBar({
  onGenerate,
  isGenerating,
  iterationCount,
  maxIterations,
  disabled = false,
}: PromptBarProps) {
  const [prompt, setPrompt] = useState('');

  const isDisabled = disabled || isGenerating || iterationCount >= maxIterations;
  const hasIterated = iterationCount > 0;

  const handleSubmit = useCallback(() => {
    const trimmed = prompt.trim();
    if (!trimmed || isDisabled) return;
    onGenerate(trimmed);
    setPrompt('');
  }, [prompt, isDisabled, onGenerate]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex items-center gap-2 p-2 border border-arena-line bg-arena-dark">
      {/* Terminal prompt symbol */}
      <span className="text-neon-green font-mono text-sm pl-2 select-none">
        &gt;
      </span>

      <input
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isDisabled}
        placeholder={
          iterationCount >= maxIterations
            ? 'Max iterations reached'
            : hasIterated
              ? 'Refine your solution...'
              : 'Describe what you want to build...'
        }
        className="flex-1 px-2 py-2 bg-transparent text-sm text-zinc-300 font-mono placeholder:text-zinc-700 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
      />

      {/* Iteration counter */}
      <span className="text-[10px] text-zinc-600 tabular-nums whitespace-nowrap px-1 font-mono">
        [{iterationCount}/{maxIterations}]
      </span>

      {/* Generate button */}
      <button
        onClick={handleSubmit}
        disabled={isDisabled || !prompt.trim()}
        className={`
          flex items-center gap-1.5 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider
          transition-all duration-150 whitespace-nowrap
          disabled:opacity-30 disabled:cursor-not-allowed
          ${
            isGenerating
              ? 'bg-neon-green/10 text-neon-green border border-neon-green/30'
              : 'bg-neon-green text-arena-black hover:brightness-110 active:scale-[0.97]'
          }
        `}
      >
        {isGenerating ? (
          <>
            <svg
              className="w-3.5 h-3.5 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            GENERATING
          </>
        ) : (
          <>
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            {hasIterated ? 'REFINE' : 'GENERATE'}
          </>
        )}
      </button>

      {/* Keyboard shortcut hint */}
      {!isDisabled && (
        <span className="hidden sm:inline text-[9px] text-zinc-700 whitespace-nowrap font-mono">
          {'\u2318'}+Enter
        </span>
      )}
    </div>
  );
}
