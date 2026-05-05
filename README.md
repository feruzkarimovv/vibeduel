# VibeDuel

Real-time multiplayer "vibecoding" arena. Two players race to build the same UI/UX challenge using an AI agent. An AI judge scores both submissions; the winner takes ELO.

**Stack:** Next.js 14 (App Router), TypeScript, Tailwind, Supabase (Postgres + Realtime), Anthropic Claude (Sonnet 4.6) for code generation and judging, Sandpack for sandboxed live preview.

## Architecture

```
┌────────────────────────────┐         ┌──────────────────────────────┐
│ Browser (anon Supabase key)│         │ Next.js API routes           │
│  - SELECT players/duels    │         │  (server uses service_role)  │
│  - INSERT new player       │         │                              │
│  - Realtime subscriptions  │ ──────▶ │  /api/match  (create/join)   │
│  - Sandpack live preview   │         │  /api/match/cancel           │
│  - Code editor + prompts   │         │  /api/match/join (invite)    │
│                            │         │  /api/duel/[id]/start        │
│                            │         │  /api/duel/[id]/finalize     │
│                            │ ──────▶ │  /api/submit                 │
│                            │         │  /api/generate (streaming)   │
└────────────────────────────┘         └──────────────────────────────┘
                                                  │            │
                                                  ▼            ▼
                                          Supabase DB    Anthropic API
                                          (RLS-locked    (codegen + judge)
                                           writes)
```

All state-changing writes (joining a duel, submitting code, advancing status, finalizing scores, updating ELO) go through server routes that use the Supabase `service_role` key. The anon browser client only does `SELECT` and the player-creation `INSERT`.

## Game flow

1. **Lobby (`/duel`)** — anonymous guest player is created on first visit (UUID stored in `localStorage`). User picks a challenge, clicks Ready, and `/api/match` either joins an open duel or creates a new one.
2. **Countdown (3-2-1-GO)** — both players load `/duel/[id]`. The first to finish countdown calls `/api/duel/[id]/start`, atomically flipping `status: countdown → active` and setting `started_at`.
3. **Active phase** — timer is computed from `started_at + timeLimit - now()` so both clients agree on the remaining time. Each player has up to 5 prompt iterations against `/api/generate`, which streams Claude's code response into the editor.
4. **Submission** — `/api/submit` upserts code into the `submissions` table. When both have submitted (or time runs out), `/api/duel/[id]/finalize` claims the duel atomically, calls Claude as judge, writes scores + ELO, and marks `status: complete`. The other client receives the realtime `complete` event and reconstructs the result.
5. **Forfeit** — if only one player submits, the submitter wins by forfeit, ELO updates, both clients see results.

## Local development

### 1. Install
```bash
npm install
```

### 2. Configure environment
Create `.env.local`:
```bash
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_SUPABASE_URL=https://your-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

### 3. Apply schema to Supabase
```bash
cat supabase/schema.sql | supabase db query --linked
```

### 4. Run
```bash
npm run dev
```

### 5. Test
```bash
npm run test:e2e
```

## Database schema

- **players**: id, username, avatar_seed, elo (default 1200), wins/losses/draws, auth_user_id, email, created_at — UNIQUE on `lower(email)` to block multi-account farming.
- **duels**: id, challenge_id, player1_id, player2_id, status (`waiting | countdown | active | judging | complete`), winner_id, invited_only, player{1,2}_elo_{before,after}, created_at, started_at, ended_at — indexed on `(status, invited_only)` and `(player{1,2}_id, ended_at)`.
- **submissions**: id, duel_id, player_id, code, iterations, score, score_breakdown (JSON), submitted_at — UNIQUE (duel_id, player_id).

**RLS:** anon clients have `SELECT` on all three tables and `INSERT` on `players` only. All other writes require `service_role`.

**Realtime:** `duels` and `submissions` are added to the `supabase_realtime` publication. Both clients subscribe to `postgres_changes` for their duel; live progress (lines / iteration / status) goes over a separate `broadcast` channel that the spectator view also listens on.

**Auth:** `middleware.ts` runs Supabase's SSR `getUser()` on every request to keep session cookies fresh. `/auth/callback` exchanges the code from email-confirmation links for a session.

## Race condition handling

Realtime is fast but not instantaneous (a 2-3 second WebSocket handshake on first subscribe), and a single missed event would otherwise hang a player. The lobby and duel room both use **realtime + polling fallback**:

- Lobby polls duel status every 2s while in `searching`, plus re-fetches once subscription confirms `SUBSCRIBED` (catches updates that fired during the handshake window).
- Duel room polls status every 3s while in `submitted`/`judging`. Player 1 force-triggers finalization 30s after entering `submitted`; player 2 takes over at 60s if P1 has ghosted.
- `/api/duel/[id]/finalize` is idempotent — both players can call it; only one wins the atomic `status: judging` claim, the rest read the existing result.

## Rate limiting

In-memory token bucket per IP, scoped per route. For multi-instance deploys, swap `src/lib/rateLimit.ts` for Upstash / Vercel KV. Current limits:

| Route | Capacity | Refill |
|---|---|---|
| `/api/match` | 5 | 1 / 5s |
| `/api/match/cancel` | 10 | 1 / 1s |
| `/api/match/join` | 5 | 1 / 2s |
| `/api/duel/[id]/start` | 5 | 1 / 2s |
| `/api/duel/[id]/finalize` | 3 | 1 / 10s |
| `/api/submit` | 5 | 1 / 2s |
| `/api/generate` | 6 | 1 / 30s |

`/api/generate` additionally requires `{ duel_id, player_id }`, verifies the player is in an `active` duel, uses the duel's `challenge_id` (server-trusted) to build the prompt, and atomically claims an iteration via the `claim_iteration(duel, player, max)` Postgres function — rejecting with `429` once `submissions.iterations` reaches 5. The atomic claim closes the read-modify-write race a fast double-click would otherwise exploit.

## Deployment

Built for Vercel. The `/duel/[id]` route is a client component dynamically imported with `ssr: false` (it depends on browser-only Supabase client + Sandpack) — both `app/duel/page.tsx` and `app/duel/[id]/page.tsx` follow this pattern.

Set the four required env vars in the Vercel project settings:

- `ANTHROPIC_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional: `NEXT_PUBLIC_SITE_URL` (e.g. `https://vibeduel.com`) — used as `metadataBase` so OG/Twitter image URLs resolve absolute. Falls back to `VERCEL_URL` and then `localhost:3000`.

## Features

- **Auth (`/auth`)** — email + password via Supabase Auth. Guests can still play; signing in upgrades the existing localStorage guest player to a permanent account that survives across devices.
- **Profile (`/me`)** — current ELO, W/L/D record, win-rate, and a line chart of ELO across completed duels (data stored in `duels.player1_elo_after` / `player2_elo_after` on finalize).
- **Private duels** — "CREATE PRIVATE DUEL" in the lobby creates an `invited_only` duel that the public matchmaker excludes; share the URL with whoever you want to play.
- **Spectator mode (`/duel/[id]/watch`)** — read-only side-by-side view of both players' live previews + scores. Subscribes to realtime; works for in-progress and completed duels.

## Open work

- Multi-account ELO farming with **different** emails is still possible (the `UNIQUE` index only blocks reuse of the same address). A captcha and email-domain blocklist on sign-up would close most of the rest.
- Spectator mode shows iteration counts but not the actual prompt history.
