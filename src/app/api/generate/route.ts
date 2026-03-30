import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured' },
      { status: 500 },
    );
  }

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  try {
    const { prompt, challenge, existingCode } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'A valid prompt string is required' },
        { status: 400 },
      );
    }

    if (!challenge?.title) {
      return NextResponse.json(
        { error: 'A valid challenge object is required' },
        { status: 400 },
      );
    }

    const systemPrompt = `You are a vibecoding AI in a competitive coding arena called VibeDuel.
You must generate a SINGLE self-contained React component that runs in a sandboxed preview.

CRITICAL RULES — FOLLOW ALL OF THESE EXACTLY:
- Start the code with: import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
- The component must be a default export. End with: export default ComponentName;
- Output ONLY the code. No markdown, no explanation, no code fences, no backticks.
- CRITICAL: Do NOT use Tailwind CSS classes or className with Tailwind utilities. The preview sandbox does NOT have Tailwind installed. Use ONLY inline styles with the style={{}} prop. Example: style={{ display: 'flex', backgroundColor: '#1a1a2e', padding: '20px' }}
- Your component must be COMPLETELY self-contained with NO external API calls, NO fetch(), NO XMLHttpRequest.
- Use hardcoded mock data instead of fetch/API calls. For example, for a weather dashboard, define realistic weather data as a const inside the component.
- The code must work in an isolated sandbox with ZERO network access.
- Do NOT use import statements except for React at the top.
- You can use React hooks: useState, useEffect, useRef, useMemo, useCallback.
- Make it visually impressive — users are judged on functionality AND visual polish.
- Use a dark color scheme with modern aesthetics (dark backgrounds like #0a0a0f, accent colors, subtle gradients).
- The component should be fully interactive and working.

The challenge is: ${challenge.title}
Description: ${challenge.description}
Scoring criteria: ${(challenge.criteria ?? []).join(', ')}`;

    const userMessage = existingCode
      ? `Here is my current code. Improve it based on this feedback: ${prompt}\n\nCurrent code:\n${existingCode}`
      : prompt;

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          controller.close();
        } catch (streamError) {
          controller.error(streamError);
        }
      },
    });

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
