/**
 * Scribble State Manager — In-memory ephemeral state for Scribble rooms.
 * Separate from Draw This Shytt game state.
 */

import type { GameTimer } from './timer';

export interface ScribblePlayer {
  id: string;          // socket ID
  nickname: string;
  avatar: any;
  totalScore: number;
  hasBeenDrawer: boolean;
}

export interface ScribbleSettings {
  rounds: number;
  maxPlayers: number;
  drawTime: number;
  wordSource: 'predefined' | 'ai';
  wordCategory: string;
}

export interface ScribbleTurnScore {
  playerId: string;
  nickname: string;
  points: number;
  guessedAt: number; // seconds remaining when guessed, 0 if not guessed
}

export interface ChatMessage {
  id: string;
  nickname: string;
  text: string;
  type: 'guess' | 'correct' | 'close' | 'system' | 'chat';
  timestamp: number;
}

export interface ScribbleRoom {
  roomCode: string;
  hostId: string;
  settings: ScribbleSettings;
  players: Map<string, ScribblePlayer>;

  // Game progress
  state: 'lobby' | 'picking' | 'drawing' | 'reveal' | 'ended';
  currentRound: number;
  currentTurn: number;
  currentWord: string;
  currentDrawerId: string;
  wordOptions: string[];

  // Fair rotation
  drawerHistory: string[];

  // Timer
  activeTimer: GameTimer | null;
  hintTimer: NodeJS.Timeout | null;

  // Revealed letters for hints
  revealedIndices: Set<number>;

  // Turn tracking
  correctGuessers: Map<string, number>;  // playerId → points earned
  turnScores: ScribbleTurnScore[];

  // Drawing data — full command log for late joiners
  drawHistory: any[];
}

// In-memory store
export const scribbleRooms: Record<string, ScribbleRoom> = {};

export const DEFAULT_SCRIBBLE_SETTINGS: ScribbleSettings = {
  rounds: 3,
  maxPlayers: 8,
  drawTime: 80,
  wordSource: 'predefined',
  wordCategory: 'Animals',
};

export function createScribbleRoom(roomCode: string, hostId: string, settings: Partial<ScribbleSettings>): ScribbleRoom {
  const room: ScribbleRoom = {
    roomCode,
    hostId,
    settings: { ...DEFAULT_SCRIBBLE_SETTINGS, ...settings },
    players: new Map(),
    state: 'lobby',
    currentRound: 0,
    currentTurn: 0,
    currentWord: '',
    currentDrawerId: '',
    wordOptions: [],
    drawerHistory: [],
    activeTimer: null,
    hintTimer: null,
    revealedIndices: new Set(),
    correctGuessers: new Map(),
    turnScores: [],
    drawHistory: [],
  };
  scribbleRooms[roomCode] = room;
  return room;
}

export function addScribblePlayer(roomCode: string, player: ScribblePlayer): boolean {
  const room = scribbleRooms[roomCode];
  if (!room) return false;
  if (room.players.size >= room.settings.maxPlayers && !room.players.has(player.id)) return false;
  room.players.set(player.id, player);
  return true;
}

export function removeScribblePlayer(roomCode: string, playerId: string): void {
  const room = scribbleRooms[roomCode];
  if (!room) return;
  room.players.delete(playerId);

  if (room.players.size === 0) {
    if (room.activeTimer) room.activeTimer.stop();
    if (room.hintTimer) clearInterval(room.hintTimer);
    delete scribbleRooms[roomCode];
    return;
  }

  if (room.hostId === playerId) {
    const nextPlayer = room.players.keys().next().value;
    if (nextPlayer) room.hostId = nextPlayer;
  }
}

export function pickNextDrawer(room: ScribbleRoom): string {
  const playerIds = Array.from(room.players.keys());
  const unpicked = playerIds.filter(id => !room.drawerHistory.includes(id));

  if (unpicked.length === 0) {
    room.drawerHistory = [];
    const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
    return shuffled[0];
  }

  const shuffled = [...unpicked].sort(() => Math.random() - 0.5);
  return shuffled[0];
}

export function getScribbleLobbyState(room: ScribbleRoom) {
  return {
    roomCode: room.roomCode,
    hostId: room.hostId,
    settings: room.settings,
    players: Array.from(room.players.values()).map(p => ({
      id: p.id,
      nickname: p.nickname,
      avatar: p.avatar,
      totalScore: p.totalScore,
    })),
    state: room.state,
    currentRound: room.currentRound,
    currentTurn: room.currentTurn,
  };
}

export function getScribbleLeaderboard(room: ScribbleRoom) {
  return Array.from(room.players.values())
    .map(p => ({
      id: p.id,
      nickname: p.nickname,
      avatar: p.avatar,
      totalScore: p.totalScore,
    }))
    .sort((a, b) => b.totalScore - a.totalScore);
}

/**
 * Compute Levenshtein distance between two strings for "close guess" detection.
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Calculate points for the Nth correct guesser (0-indexed).
 * Combines an order bonus (rewarding being first) with a time bonus
 * (rewarding guessing quickly). 
 * 
 * Formula:  orderBonus + timeBonus
 *   orderBonus: 1st=50, 2nd=40, 3rd=30, 4th=25, 5th=20, 6th+=15
 *   timeBonus:  floor((timeRemaining / totalTime) * 100)  → 0-100 pts
 * 
 * Max possible: 150 (1st guesser, instant guess)
 * Min possible: 15  (6th+ guesser, last-second guess)
 */
export function calculateGuessPoints(
  guessOrder: number,
  timeRemaining: number = 0,
  totalDrawTime: number = 80,
): number {
  const orderBonuses = [50, 40, 30, 25, 20];
  const orderBonus = guessOrder < orderBonuses.length
    ? orderBonuses[guessOrder]
    : 15; // minimum order bonus

  const timeRatio = totalDrawTime > 0 ? Math.max(0, timeRemaining) / totalDrawTime : 0;
  const timeBonus = Math.floor(timeRatio * 100);

  return orderBonus + timeBonus;
}

/**
 * Generate the blanks string for a word, revealing specified indices.
 */
export function generateBlanks(word: string, revealedIndices: Set<number>): string {
  return word
    .split('')
    .map((ch, i) => {
      if (ch === ' ') return '  ';
      if (revealedIndices.has(i)) return ch;
      return '_';
    })
    .join(' ');
}
