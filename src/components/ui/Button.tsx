'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly children: ReactNode;
};

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-neon-green text-arena-black font-bold hover:brightness-110 shadow-[0_0_20px_rgba(15,244,122,0.3)] hover:shadow-[0_0_30px_rgba(15,244,122,0.4)]',
  secondary:
    'bg-neon-magenta text-white font-bold hover:brightness-110 shadow-[0_0_20px_rgba(255,51,102,0.3)] hover:shadow-[0_0_30px_rgba(255,51,102,0.4)]',
  ghost:
    'bg-transparent text-zinc-300 hover:text-white border border-zinc-700 hover:border-zinc-500',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-xs',
  md: 'px-6 py-3 text-sm',
  lg: 'px-8 py-4 text-base',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center font-mono uppercase tracking-wider
        transition-all duration-150 ease-out
        active:scale-[0.97]
        disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}
