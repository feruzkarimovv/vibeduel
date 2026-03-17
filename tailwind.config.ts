import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        neon: {
          green: '#0ff47a',
          magenta: '#ff3366',
          cyan: '#00e5ff',
        },
        arena: {
          black: '#050505',
          dark: '#0a0a0a',
          mid: '#141414',
          line: '#1a1a1a',
        },
      },
      fontFamily: {
        sans: ['var(--font-syne)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-space-mono)', 'monospace'],
        display: ['var(--font-syne)', 'system-ui', 'sans-serif'],
      },
      animation: {
        'scanline': 'scanline 8s linear infinite',
        'glitch-1': 'glitch1 3s infinite linear alternate-reverse',
        'glitch-2': 'glitch2 2.5s infinite linear alternate-reverse',
        'flicker': 'flicker 0.15s infinite',
        'pulse-neon': 'pulseNeon 2s ease-in-out infinite',
        'slide-up': 'slideUp 0.6s ease-out forwards',
        'slide-up-delay-1': 'slideUp 0.6s ease-out 0.1s forwards',
        'slide-up-delay-2': 'slideUp 0.6s ease-out 0.2s forwards',
        'slide-up-delay-3': 'slideUp 0.6s ease-out 0.3s forwards',
        'slide-up-delay-4': 'slideUp 0.6s ease-out 0.4s forwards',
        'vs-slam': 'vsSlam 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.5s forwards',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        glitch1: {
          '0%, 100%': { clipPath: 'inset(0 0 0 0)', transform: 'translate(0)' },
          '20%': { clipPath: 'inset(20% 0 60% 0)', transform: 'translate(-2px, 1px)' },
          '40%': { clipPath: 'inset(40% 0 30% 0)', transform: 'translate(2px, -1px)' },
          '60%': { clipPath: 'inset(60% 0 10% 0)', transform: 'translate(-1px, 2px)' },
          '80%': { clipPath: 'inset(10% 0 80% 0)', transform: 'translate(1px, -2px)' },
        },
        glitch2: {
          '0%, 100%': { clipPath: 'inset(0 0 0 0)', transform: 'translate(0)' },
          '25%': { clipPath: 'inset(50% 0 20% 0)', transform: 'translate(3px, 0)' },
          '50%': { clipPath: 'inset(10% 0 70% 0)', transform: 'translate(-3px, 0)' },
          '75%': { clipPath: 'inset(70% 0 5% 0)', transform: 'translate(2px, 0)' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        pulseNeon: {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '50%': { opacity: '0.7', filter: 'brightness(1.3)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        vsSlam: {
          '0%': { opacity: '0', transform: 'scale(3) rotate(-12deg)' },
          '60%': { opacity: '1', transform: 'scale(0.9) rotate(2deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(0deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
