import { Challenge } from '@/types';

export const challenges: readonly Challenge[] = [
  {
    id: 'calc-01',
    title: 'Build a working calculator',
    description: 'Create a fully functional calculator with basic arithmetic operations (+, -, ×, ÷). Include a clean display and responsive button grid.',
    difficulty: 'easy',
    timeLimit: 120,
    criteria: ['Functional arithmetic', 'Clean UI', 'Error handling for division by zero', 'Responsive layout'],
  },
  {
    id: 'weather-02',
    title: 'Create a weather dashboard UI',
    description: 'Design a weather dashboard showing current conditions, a 5-day forecast, and key metrics like humidity and wind speed. Use mock data.',
    difficulty: 'medium',
    timeLimit: 180,
    criteria: ['Visual design quality', 'Data presentation clarity', 'Responsive layout', 'Weather icons/visuals'],
  },
  {
    id: 'pomodoro-03',
    title: 'Build a Pomodoro timer',
    description: 'Create a Pomodoro timer with work/break intervals, start/pause/reset controls, and visual feedback for the current phase.',
    difficulty: 'easy',
    timeLimit: 120,
    criteria: ['Timer accuracy', 'Phase transitions', 'Visual feedback', 'Control buttons work'],
  },
  {
    id: 'pricing-04',
    title: 'Design a pricing page for a SaaS product',
    description: 'Build a pricing page with 3 tiers (Free, Pro, Enterprise), feature comparison, toggle for monthly/annual billing, and highlighted recommended plan.',
    difficulty: 'medium',
    timeLimit: 150,
    criteria: ['Visual hierarchy', 'Billing toggle works', 'Feature comparison clarity', 'CTA prominence'],
  },
  {
    id: 'snake-05',
    title: 'Build a snake game',
    description: 'Create a classic Snake game with keyboard controls, score tracking, increasing difficulty, and game over detection.',
    difficulty: 'hard',
    timeLimit: 240,
    criteria: ['Game mechanics work', 'Smooth movement', 'Score tracking', 'Collision detection', 'Increasing speed'],
  },
  {
    id: 'kanban-06',
    title: 'Create a kanban board with drag and drop',
    description: 'Build a kanban board with at least 3 columns (To Do, In Progress, Done). Cards should be draggable between columns.',
    difficulty: 'hard',
    timeLimit: 240,
    criteria: ['Drag and drop works', 'Column management', 'Card creation', 'Visual feedback during drag', 'Persistence of state'],
  },
  {
    id: 'chat-07',
    title: 'Build a real-time chat UI',
    description: 'Create a chat interface with message bubbles, a text input, timestamps, and visual distinction between sent/received messages. Use mock data.',
    difficulty: 'medium',
    timeLimit: 180,
    criteria: ['Message bubble design', 'Input functionality', 'Timestamps', 'Scroll behavior', 'Responsive layout'],
  },
  {
    id: 'space-08',
    title: 'Create an animated landing page for a space startup',
    description: 'Design a stunning landing page for "NovaStar" space tourism. Include hero with animation, feature section, and CTA. Dark theme with stars.',
    difficulty: 'medium',
    timeLimit: 180,
    criteria: ['Animation quality', 'Visual design', 'Content hierarchy', 'Dark theme execution', 'Responsive layout'],
  },
  {
    id: 'markdown-09',
    title: 'Build a markdown editor with live preview',
    description: 'Create a split-pane markdown editor. Left side is a textarea for writing markdown, right side shows the rendered HTML preview in real-time.',
    difficulty: 'medium',
    timeLimit: 180,
    criteria: ['Real-time preview', 'Markdown parsing accuracy', 'Split pane layout', 'Code block styling', 'Responsive design'],
  },
  {
    id: 'music-10',
    title: 'Create a music player UI with visualizer',
    description: 'Build a music player interface with play/pause/skip controls, a progress bar, album art display, and an animated audio visualizer (mock animation).',
    difficulty: 'hard',
    timeLimit: 240,
    criteria: ['Player controls work', 'Progress bar interaction', 'Visualizer animation', 'Album art display', 'Visual polish'],
  },
] as const;

export function getRandomChallenge(): Challenge {
  const index = Math.floor(Math.random() * challenges.length);
  return challenges[index];
}

export function getChallengeById(id: string): Challenge | undefined {
  return challenges.find((c) => c.id === id);
}
