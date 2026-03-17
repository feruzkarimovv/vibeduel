'use client';

import { useEffect, useState, useRef } from 'react';
import { SandpackProvider, SandpackPreview } from '@codesandbox/sandpack-react';

type LivePreviewProps = {
  readonly code: string;
  readonly isStreaming?: boolean;
};

const DEFAULT_CODE = `import React from 'react';

export default function App() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#050505',
      color: '#444',
      fontFamily: 'monospace',
    }}>
      <p style={{ letterSpacing: '0.2em', fontSize: '11px', textTransform: 'uppercase' }}>
        Waiting for code generation...
      </p>
    </div>
  );
}`;

// Custom index.js with error boundary to catch runtime errors
// This prevents the "message is read-only" Sandpack crash
const INDEX_JS = `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return React.createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#050505",
          color: "#ff3366",
          fontFamily: "monospace",
          padding: "20px",
          textAlign: "center",
        }
      },
        React.createElement("div", {
          style: { fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "12px", color: "#666" }
        }, "RENDER ERROR"),
        React.createElement("div", {
          style: { fontSize: "13px", color: "#ff3366", maxWidth: "400px", wordBreak: "break-word" }
        }, String(this.state.error?.message || this.state.error || "Unknown error")),
        React.createElement("button", {
          onClick: () => this.setState({ error: null }),
          style: {
            marginTop: "16px",
            padding: "6px 16px",
            background: "transparent",
            border: "1px solid #333",
            color: "#888",
            fontFamily: "monospace",
            fontSize: "11px",
            cursor: "pointer",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }
        }, "Retry")
      );
    }
    return this.props.children;
  }
}

const root = createRoot(document.getElementById("root"));
root.render(
  React.createElement(ErrorBoundary, null,
    React.createElement(App)
  )
);`;

function sanitizeCode(code: string): string {
  let cleaned = code;

  // Remove markdown code fences if present
  cleaned = cleaned.replace(/^```[\w]*\n?/gm, '').replace(/\n?```$/gm, '');

  // Remove "use client" directives
  cleaned = cleaned.replace(/['"]use client['"];?\n?/g, '');

  // Ensure React import exists
  if (!cleaned.includes('import React') && !cleaned.includes("from 'react'")) {
    cleaned =
      "import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';\n" +
      cleaned;
  }

  // Ensure there's a default export
  if (!cleaned.includes('export default')) {
    const match = cleaned.match(/(?:function|const)\s+(\w+)\s*[=(]/);
    if (match) {
      cleaned += `\nexport default ${match[1]};`;
    }
  }

  return cleaned;
}

// CSS overrides to force Sandpack internals to fill parent height
const SANDPACK_HEIGHT_CSS = `
  .sp-wrapper { height: 100% !important; }
  .sp-layout { height: 100% !important; border: none !important; background: transparent !important; }
  .sp-preview { height: 100% !important; }
  .sp-preview-container { height: 100% !important; }
  .sp-preview-iframe { height: 100% !important; }
  .sp-stack { height: 100% !important; }
`;

export default function LivePreview({
  code,
  isStreaming = false,
}: LivePreviewProps) {
  const [debouncedCode, setDebouncedCode] = useState(DEFAULT_CODE);
  const [hasError, setHasError] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const delay = isStreaming ? 1500 : 500;

    timeoutRef.current = setTimeout(() => {
      if (code && code.trim().length > 50) {
        setDebouncedCode(code);
        setHasError(false);
      }
    }, delay);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [code, isStreaming]);

  const displayCode = sanitizeCode(debouncedCode);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* Preview header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-arena-mid/50 border-b border-arena-line">
        <span className="text-[10px] text-zinc-600 font-mono uppercase tracking-wider">
          Preview
        </span>
        <div className="flex items-center gap-1.5">
          {isStreaming ? (
            <>
              <div className="w-1.5 h-1.5 bg-amber-500 animate-pulse" />
              <span className="text-[10px] text-amber-500 font-mono">
                STREAMING
              </span>
            </>
          ) : hasError ? (
            <>
              <div className="w-1.5 h-1.5 bg-neon-magenta" />
              <span className="text-[10px] text-neon-magenta font-mono">
                ERROR
              </span>
            </>
          ) : code.trim() ? (
            <>
              <div className="w-1.5 h-1.5 bg-neon-green animate-pulse" />
              <span className="text-[10px] text-zinc-600 font-mono">LIVE</span>
            </>
          ) : (
            <span className="text-[10px] text-zinc-800 font-mono">IDLE</span>
          )}
        </div>
      </div>

      {/* Sandpack preview — fills all remaining space */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <style dangerouslySetInnerHTML={{ __html: SANDPACK_HEIGHT_CSS }} />
        <SandpackProvider
          key={displayCode}
          template="react"
          theme="dark"
          files={{
            '/App.js': {
              code: displayCode,
              active: true,
            },
            '/index.js': {
              code: INDEX_JS,
              hidden: true,
            },
          }}
          options={{
            autorun: true,
            autoReload: true,
          }}
        >
          <SandpackPreview
            style={{ height: '100%', width: '100%', border: 'none' }}
            showOpenInCodeSandbox={false}
            showRefreshButton={true}
          />
        </SandpackProvider>
      </div>
    </div>
  );
}
