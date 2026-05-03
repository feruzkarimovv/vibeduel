import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const MAX_PROMPT_LEN = 2000;
const MAX_EXISTING_CODE_LEN = 20000;
const ERROR_SENTINEL = '\n\n__VIBEDUEL_STREAM_ERROR__:';

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured' },
      { status: 500 },
    );
  }

  let body: {
    prompt?: unknown;
    challenge?: { title?: unknown; description?: unknown; criteria?: unknown };
    existingCode?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { prompt, challenge, existingCode } = body;

  if (typeof prompt !== 'string' || !prompt.trim()) {
    return NextResponse.json(
      { error: 'A valid prompt string is required' },
      { status: 400 },
    );
  }
  if (prompt.length > MAX_PROMPT_LEN) {
    return NextResponse.json(
      { error: `Prompt exceeds ${MAX_PROMPT_LEN} characters` },
      { status: 400 },
    );
  }
  if (
    !challenge ||
    typeof challenge !== 'object' ||
    typeof challenge.title !== 'string'
  ) {
    return NextResponse.json(
      { error: 'A valid challenge object is required' },
      { status: 400 },
    );
  }
  if (
    existingCode !== undefined &&
    (typeof existingCode !== 'string' ||
      existingCode.length > MAX_EXISTING_CODE_LEN)
  ) {
    return NextResponse.json(
      { error: `existingCode must be a string under ${MAX_EXISTING_CODE_LEN} chars` },
      { status: 400 },
    );
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const systemPrompt = `You are a vibecoding AI in a competitive coding arena called VibeDuel.
You must generate a SINGLE self-contained React component that runs in a sandboxed preview.

CRITICAL RULES — FOLLOW ALL OF THESE EXACTLY:
- Start the code with: import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
- The component MUST be named App and end with: export default App;
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
Description: ${typeof challenge.description === 'string' ? challenge.description : ''}
Scoring criteria: ${Array.isArray(challenge.criteria) ? challenge.criteria.join(', ') : ''}`;

  const userMessage =
    typeof existingCode === 'string' && existingCode.trim()
      ? `Here is my current code. Improve it based on this feedback: ${prompt}\n\nCurrent code:\n${existingCode}`
      : prompt;

  // Open the stream synchronously so any auth / quota errors fail BEFORE we
  // commit to a 200 response. This is the C-1 fix: the original code returned
  // Response(readable) before the underlying API call had really started, so
  // a 401/429 from Anthropic produced a 200-then-empty body that the client
  // could not interpret.
  let stream: Awaited<ReturnType<typeof client.messages.stream>>;
  try {
    stream = await client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
  } catch (error) {
    const status =
      error instanceof Anthropic.APIError ? error.status ?? 500 : 500;
    const message =
      error instanceof Error ? error.message : 'Unknown error opening stream';
    return NextResponse.json({ error: message }, { status });
  }

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
        // Mid-stream failure: emit a sentinel the client can detect, then close
        // cleanly. controller.error() would abort the response and surface as a
        // generic TypeError on the client.
        const message =
          streamError instanceof Error
            ? streamError.message
            : 'Stream interrupted';
        try {
          controller.enqueue(
            encoder.encode(`${ERROR_SENTINEL}${message}`),
          );
        } catch {
          // controller may already be closed
        }
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
