/**
 * Game State Manager — In-memory ephemeral state for "Draw This Shytt" rooms.
 * No database — state lives only while the room is active.
 */

import type { GameTimer } from './timer';

export interface GamePlayer {
  id: string;          // socket ID
  nickname: string;
  avatar: any;
  totalScore: number;
  hasBeenPicker: boolean; // Track fair picker rotation
}

export interface GameSettings {
  rounds: number;        // default 3
  maxPlayers: number;    // default 5
  drawTime: number;      // seconds, default 60
  wordSource: 'predefined' | 'ai';
  wordCategory: string;  // used when wordSource is 'predefined'
}

export interface TurnScore {
  playerId: string;
  nickname: string;
  score: number;
  drawingPng: string;    // base64 PNG
}

export interface GameRoom {
  roomCode: string;
  hostId: string;
  settings: GameSettings;
  players: Map<string, GamePlayer>;
  
  // Game progress
  state: 'lobby' | 'picking' | 'drawing' | 'scoring' | 'reveal' | 'ended';
  currentRound: number;
  currentTurn: number;
  currentWord: string;
  currentPickerId: string;
  wordOptions: string[];   // 3 words shown to picker
  
  // Fair rotation tracking
  pickerHistory: string[]; // IDs of users who have been picker this cycle
  
  // Timer reference
  activeTimer: GameTimer | null;
  
  // Current turn drawings (collected during scoring phase)
  turnDrawings: Map<string, string>; // playerId -> base64 PNG
  turnScores: TurnScore[];
}

// In-memory store
export const gameRooms: Record<string, GameRoom> = {};

export const DEFAULT_SETTINGS: GameSettings = {
  rounds: 3,
  maxPlayers: 5,
  drawTime: 60,
  wordSource: 'predefined',
  wordCategory: 'Animals',
};

/**
 * Create a new game room
 */
export function createGameRoom(roomCode: string, hostId: string, settings: Partial<GameSettings>): GameRoom {
  const room: GameRoom = {
    roomCode,
    hostId,
    settings: { ...DEFAULT_SETTINGS, ...settings },
    players: new Map(),
    state: 'lobby',
    currentRound: 0,
    currentTurn: 0,
    currentWord: '',
    currentPickerId: '',
    wordOptions: [],
    pickerHistory: [],
    activeTimer: null,
    turnDrawings: new Map(),
    turnScores: [],
  };
  gameRooms[roomCode] = room;
  return room;
}

/**
 * Add a player to a game room
 */
export function addPlayer(roomCode: string, player: GamePlayer): boolean {
  const room = gameRooms[roomCode];
  if (!room) return false;
  if (room.players.size >= room.settings.maxPlayers && !room.players.has(player.id)) return false;
  room.players.set(player.id, player);
  return true;
}

/**
 * Remove a player from a game room
 */
export function removePlayer(roomCode: string, playerId: string): void {
  const room = gameRooms[roomCode];
  if (!room) return;
  room.players.delete(playerId);
  
  // If room is empty, clean up
  if (room.players.size === 0) {
    if (room.activeTimer) room.activeTimer.stop();
    delete gameRooms[roomCode];
    return;
  }
  
  // If host left, promote next player
  if (room.hostId === playerId) {
    const nextPlayer = room.players.keys().next().value;
    if (nextPlayer) room.hostId = nextPlayer;
  }
}

/**
 * Pick the next word picker using fair rotation.
 * No user gets picked again until everyone has been picker at least once.
 */
export function pickNextPicker(room: GameRoom): string {
  const playerIds = Array.from(room.players.keys());
  
  // Get players who haven't been picked this cycle
  const unpicked = playerIds.filter(id => !room.pickerHistory.includes(id));
  
  // If everyone has been picked, reset the cycle
  if (unpicked.length === 0) {
    room.pickerHistory = [];
    const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
    return shuffled[0];
  }
  
  // Random from unpicked
  const shuffled = [...unpicked].sort(() => Math.random() - 0.5);
  return shuffled[0];
}

/**
 * Get serializable game state for lobby broadcast
 */
export function getGameLobbyState(room: GameRoom) {
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

/**
 * Get leaderboard sorted by score
 */
export function getLeaderboard(room: GameRoom) {
  return Array.from(room.players.values())
    .map(p => ({
      id: p.id,
      nickname: p.nickname,
      avatar: p.avatar,
      totalScore: p.totalScore,
    }))
    .sort((a, b) => b.totalScore - a.totalScore);
}
