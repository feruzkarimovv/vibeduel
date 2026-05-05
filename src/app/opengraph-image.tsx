import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'VibeDuel — The Competitive Arena for AI-Powered Coding';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#050505',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'monospace',
          backgroundImage:
            'radial-gradient(circle at 0% 0%, rgba(15,244,122,0.15), transparent 40%), radial-gradient(circle at 100% 100%, rgba(255,51,102,0.15), transparent 40%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 24,
          }}
        >
          <div
            style={{
              fontSize: 180,
              fontWeight: 900,
              color: '#fff',
              letterSpacing: -6,
            }}
          >
            VIBE
          </div>
          <div
            style={{
              fontSize: 180,
              fontWeight: 900,
              color: '#0ff47a',
              letterSpacing: -6,
              textShadow:
                '0 0 40px rgba(15,244,122,0.5), 0 0 100px rgba(15,244,122,0.2)',
            }}
          >
            DUEL
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginTop: 32,
            color: '#888',
            fontSize: 28,
            letterSpacing: 8,
            textTransform: 'uppercase',
          }}
        >
          <span style={{ width: 12, height: 12, background: '#0ff47a' }} />
          Ship or Get Shipped
          <span style={{ width: 12, height: 12, background: '#ff3366' }} />
        </div>
      </div>
    ),
    size,
  );
}
