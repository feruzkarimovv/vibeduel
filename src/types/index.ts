export type Difficulty = 'easy' | 'medium' | 'hard';

export type Challenge = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly difficulty: Difficulty;
  readonly timeLimit: number;
  readonly criteria: readonly string[];
};

export type DuelStatus = 'waiting' | 'countdown' | 'active' | 'judging' | 'complete';

export type Player = {
  readonly id: string;
  readonly username: string;
  readonly avatar_seed?: string;
  readonly elo: number;
  readonly wins?: number;
  readonly losses?: number;
  readonly draws?: number;
  readonly created_at?: string;
};

export type DuelRow = {
  readonly id: string;
  readonly challenge_id: string;
  readonly player1_id: string;
  readonly player2_id: string | null;
  readonly status: DuelStatus;
  readonly winner_id: string | null;
  readonly created_at: string;
  readonly started_at: string | null;
  readonly ended_at: string | null;
};

export type SubmissionRow = {
  readonly id: string;
  readonly duel_id: string;
  readonly player_id: string;
  readonly code: string;
  readonly score: number | null;
  readonly score_breakdown: Record<string, number> | null;
  readonly submitted_at: string;
};

export type OpponentProgress = {
  readonly playerId: string;
  readonly lineCount: number;
  readonly charCount: number;
  readonly iterationCount: number;
  readonly hasPreview: boolean;
  readonly status: 'coding' | 'submitted' | 'idle';
};
