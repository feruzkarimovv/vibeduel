import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { rateLimit, clientKey } from '@/lib/rateLimit';
import { getChallengeById } from '@/lib/challenges';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_PROMPT_LEN = 2000;
const MAX_EXISTING_CODE_LEN = 20000;
const MAX_ITERATIONS = 5;
const ERROR_SENTINEL = '\n\n__VIBEDUEL_STREAM_ERROR__:';

export async function POST(req: Request) {
  // Cost cap: per-IP burst of 6, refilling at 1/30s. The 5-iteration UX limit
  // is enforced client-side, but the unauthenticated public endpoint also
  // needs hard server-side bounds against scripted abuse.
  const limit = rateLimit(clientKey(req, 'generate'), {
    capacity: 6,
    refillPerSecond: 1 / 30,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured' },
      { status: 500 },
    );
  }

  let body: {
    prompt?: unknown;
    existingCode?: unknown;
    duel_id?: unknown;
    player_id?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { prompt, existingCode, duel_id, player_id } = body;

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
    existingCode !== undefined &&
    (typeof existingCode !== 'string' ||
      existingCode.length > MAX_EXISTING_CODE_LEN)
  ) {
    return NextResponse.json(
      { error: `existingCode must be a string under ${MAX_EXISTING_CODE_LEN} chars` },
      { status: 400 },
    );
  }
  if (typeof duel_id !== 'string' || typeof player_id !== 'string') {
    return NextResponse.json(
      { error: 'duel_id and player_id required' },
      { status: 400 },
    );
  }

  // Bind generation to an active duel that this player belongs to. The
  // challenge object is still trusted from the client (it only shapes the
  // prompt), but we re-validate the id against our challenge catalogue and
  // confirm it matches the duel's challenge_id.
  const sb = getAdminClient();
  const { data: duel } = await sb
    .from('duels')
    .select('player1_id, player2_id, status, challenge_id')
    .eq('id', duel_id)
    .single();
  if (!duel) {
    return NextResponse.json({ error: 'duel not found' }, { status: 404 });
  }
  if (duel.player1_id !== player_id && duel.player2_id !== player_id) {
    return NextResponse.json({ error: 'not in this duel' }, { status: 403 });
  }
  if (duel.status !== 'active') {
    return NextResponse.json(
      { error: `duel is ${duel.status}, not active` },
      { status: 409 },
    );
  }
  const serverChallenge = getChallengeById(duel.challenge_id);
  if (!serverChallenge) {
    return NextResponse.json({ error: 'invalid challenge' }, { status: 500 });
  }

  // Server-side iteration cap. Without this, a scripted client can keep
  // calling /api/generate past the 5-prompt UX limit and burn arbitrary
  // Anthropic spend. The submissions row is created lazily on first generate
  // and the bookkeeping survives /api/submit (which only writes code).
  const { data: subRow } = await sb
    .from('submissions')
    .select('id, iterations')
    .eq('duel_id', duel_id)
    .eq('player_id', player_id)
    .maybeSingle();
  const currentIterations = subRow?.iterations ?? 0;
  if (currentIterations >= MAX_ITERATIONS) {
    return NextResponse.json(
      { error: 'iteration cap reached' },
      { status: 429 },
    );
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const isRefine =
    typeof existingCode === 'string' && existingCode.trim().length > 0;

  const baseRules = `CRITICAL RULES — FOLLOW ALL OF THESE EXACTLY:
- Start the code with: import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
- The component MUST be named App and end with: export default App;
- Output ONLY the code. No markdown, no explanation, no code fences, no backticks.
- CRITICAL: Do NOT use Tailwind CSS classes or className with Tailwind utilities. The preview sandbox does NOT have Tailwind installed. Use ONLY inline styles with the style={{}} prop. Example: style={{ display: 'flex', backgroundColor: '#1a1a2e', padding: '20px' }}
- Your component must be COMPLETELY self-contained with NO external API calls, NO fetch(), NO XMLHttpRequest.
- Use hardcoded mock data instead of fetch/API calls. For example, for a weather dashboard, define realistic weather data as a const inside the component.
- The code must work in an isolated sandbox with ZERO network access.
- Do NOT use import statements except for React at the top.
- You can use React hooks: useState, useEffect, useRef, useMemo, useCallback.

The challenge is: ${serverChallenge.title}
Description: ${serverChallenge.description}
Scoring criteria: ${serverChallenge.criteria.join(', ')}`;

  const systemPrompt = isRefine
    ? `You are editing an existing React component for a vibecoding arena called VibeDuel.

YOUR JOB: apply the user's requested change to the existing component, and ONLY that change. You are NOT writing a new component. You are NOT free to redesign anything the user did not ask about.

MANDATORY EDITING RULES — these override all other instincts:
- Output the COMPLETE updated component (the entire file, top to bottom) with ONLY the user's requested change applied.
- PRESERVE the existing structure, variable names, state shape, mock data, layout, and visual styling. Do not rename things. Do not "improve" code the user did not mention. Do not refactor.
- If the user asks for a small change (e.g. "make columns wider", "add a button"), touch only the lines needed for that change. Everything else must come back identical.
- Treat the existing code as the source of truth. Treat the user's prompt as a surgical instruction.

${baseRules}`
    : `You are a vibecoding AI in a competitive coding arena called VibeDuel.
You must generate a SINGLE self-contained React component that runs in a sandboxed preview.

${baseRules}
- Make it visually impressive — users are judged on functionality AND visual polish.
- Use a dark color scheme with modern aesthetics (dark backgrounds like #0a0a0f, accent colors, subtle gradients).
- The component should be fully interactive and working.`;

  const userMessage = isRefine
    ? `Apply this change to my existing component, and ONLY this change. Preserve everything else exactly as it is.

Change requested:
${prompt}

Existing component (return the full file with the change applied — do NOT rewrite from scratch, do NOT change anything I did not ask about):
${existingCode}`
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
      max_tokens: 8192,
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

  // We're past the API auth/quota gate and committed to spending tokens —
  // record the iteration. Read-modify-write is racy under double-clicks
  // (worst case the player sneaks one extra), but the cap still holds.
  if (subRow) {
    await sb
      .from('submissions')
      .update({ iterations: currentIterations + 1 })
      .eq('id', subRow.id);
  } else {
    await sb.from('submissions').insert({
      duel_id,
      player_id,
      code: '',
      iterations: 1,
    });
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
          } else if (
            event.type === 'message_delta' &&
            event.delta.stop_reason === 'max_tokens'
          ) {
            // The model ran out of output budget. The text we already streamed
            // is almost certainly cut mid-statement, so feeding it to Sandpack
            // produces a SyntaxError. Tell the client so it can warn and not
            // burn an iteration on a doomed render.
            controller.enqueue(
              encoder.encode(
                `${ERROR_SENTINEL}max_tokens_truncation`,
              ),
            );
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
