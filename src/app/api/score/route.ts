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
    const { challenge, submission1, submission2 } = await req.json();

    if (!challenge?.title) {
      return NextResponse.json(
        { error: 'A valid challenge is required' },
        { status: 400 },
      );
    }

    const systemPrompt = `You are the official judge of VibeDuel, a competitive vibecoding arena. You must evaluate two code submissions for the same challenge and score them fairly.

You MUST respond with ONLY valid JSON, no markdown, no code fences, no explanation outside the JSON. The response must be parseable by JSON.parse().

Score each submission on these categories (0-20 points each, total max 100):
1. "functionality" — Does it work? Does it do what the challenge asks?
2. "visual_design" — Is it visually polished? Good colors, layout, spacing?
3. "creativity" — Any clever or unexpected touches? Goes beyond minimum requirements?
4. "code_quality" — Clean structure, good patterns, readable code?
5. "completeness" — How many of the scoring criteria are met?

Response format:
{
  "player1": {
    "functionality": <0-20>,
    "visual_design": <0-20>,
    "creativity": <0-20>,
    "code_quality": <0-20>,
    "completeness": <0-20>,
    "total": <0-100>,
    "feedback": "<one sentence of feedback>"
  },
  "player2": {
    "functionality": <0-20>,
    "visual_design": <0-20>,
    "creativity": <0-20>,
    "code_quality": <0-20>,
    "completeness": <0-20>,
    "total": <0-100>,
    "feedback": "<one sentence of feedback>"
  },
  "winner": "player1" | "player2" | "draw",
  "commentary": "<one exciting sentence about the duel result, like a sports commentator>"
}

Be fair, honest, and specific. If one submission is clearly better, say so. Don't be afraid to give low scores for broken or lazy code, and high scores for impressive work.`;

    const userMessage = `Challenge: ${challenge.title}
Description: ${challenge.description}
Scoring Criteria: ${(challenge.criteria ?? []).join(', ')}

=== PLAYER 1 SUBMISSION ===
${submission1?.code || '// No code submitted'}

=== PLAYER 2 SUBMISSION ===
${submission2?.code || '// No code submitted'}`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    const cleaned = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    try {
      const scores = JSON.parse(cleaned);
      return NextResponse.json(scores);
    } catch {
      console.error('Failed to parse scoring response:', text);
      return NextResponse.json({
        player1: {
          functionality: 10, visual_design: 10, creativity: 10,
          code_quality: 10, completeness: 10, total: 50,
          feedback: 'Score could not be fully evaluated.',
        },
        player2: {
          functionality: 10, visual_design: 10, creativity: 10,
          code_quality: 10, completeness: 10, total: 50,
          feedback: 'Score could not be fully evaluated.',
        },
        winner: 'draw',
        commentary: 'The judge had trouble evaluating — calling it a draw!',
      });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
