'use client';

import { useEffect } from 'react';

// Catches errors thrown in the root layout itself (where app/error.tsx can't
// reach). Must render its own <html> and <body>.
export default function GlobalError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          background: '#050505',
          color: '#e8e8e8',
          fontFamily: 'monospace',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '28rem' }}>
          <div
            style={{
              width: 64,
              height: 64,
              border: '2px solid rgba(255,51,102,0.4)',
              margin: '0 auto 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 700,
              color: '#ff3366',
            }}
          >
            !
          </div>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 900,
              color: '#fff',
              textTransform: 'uppercase',
              letterSpacing: '-0.025em',
              marginBottom: '1rem',
            }}
          >
            Fatal error
          </h2>
          <p
            style={{
              color: '#666',
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '1.25rem',
            }}
          >
            The arena failed to mount.
          </p>
          <button
            onClick={reset}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#0ff47a',
              color: '#050505',
              border: 'none',
              fontFamily: 'monospace',
              fontWeight: 700,
              fontSize: 14,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </body>
    </html>
  );
}
