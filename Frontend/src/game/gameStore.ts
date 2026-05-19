/**
 * Game Store — Zustand state for "Draw This Shytt" game mode.
 * Completely separate from the whiteboard store.
 */

import { create } from 'zustand';

export interface GamePlayer {
  id: string;
  nickname: string;
  avatar: any;
  totalScore: number;
}

export interface GameSettings {
  rounds: number;
  maxPlayers: number;
  drawTime: number;
  wordSource: 'predefined' | 'ai';
  wordCategory: string;
}

export interface TurnScoreEntry {
  playerId: string;
  nickname: string;
  score: number;
  drawingPng: string;
}

export type GameScreen =
  | 'menu'       // Main menu — choose game mode
  | 'lobby'      // Host/join lobby
  | 'waiting'    // Non-picker waiting for picker
  | 'picking'    // Picker selecting word
  | 'countdown'  // 3..2..1 before drawing
  | 'drawing'    // Active drawing phase
  | 'spectating' // Picker watching others draw
  | 'scoring'    // Waiting for AI scores
  | 'reveal'     // Showing scores + drawings
  | 'final';     // Final leaderboard

interface GameState {
  // Connection
  screen: GameScreen;
  roomCode: string;
  isHost: boolean;
  myId: string;
  myNickname: string;

  // Room state
  players: GamePlayer[];
  settings: GameSettings;
  hostId: string;

  // Turn state
  currentRound: number;
  currentTurn: number;
  totalRounds: number;
  turnsPerRound: number;
  pickerId: string;
  pickerName: string;
  role: 'picker' | 'drawer' | '';
  wordOptions: string[];
  selectedWord: string;
  timerValue: number;

  // Scores
  turnScores: TurnScoreEntry[];
  leaderboard: GamePlayer[];
  finalScores: GamePlayer[];
  winner: GamePlayer | null;

  // Spectator canvases (for picker)
  spectatorCanvases: Map<string, { nickname: string; pngBase64: string }>;

  // Toast
  gameToast: string;
  gameToastType: 'success' | 'error' | 'info';
  gameToastVisible: boolean;

  // Actions
  setScreen: (screen: GameScreen) => void;
  setRoomCode: (code: string) => void;
  setIsHost: (isHost: boolean) => void;
  setMyId: (id: string) => void;
  setMyNickname: (nickname: string) => void;
  setPlayers: (players: GamePlayer[]) => void;
  setSettings: (settings: GameSettings) => void;
  setHostId: (id: string) => void;
  setTurnState: (state: Partial<Pick<GameState, 'currentRound' | 'currentTurn' | 'totalRounds' | 'turnsPerRound' | 'pickerId' | 'pickerName' | 'role' | 'wordOptions'>>) => void;
  setSelectedWord: (word: string) => void;
  setTimerValue: (value: number) => void;
  setTurnScores: (scores: TurnScoreEntry[]) => void;
  setLeaderboard: (board: GamePlayer[]) => void;
  setFinalScores: (scores: GamePlayer[], winner: GamePlayer | null) => void;
  updateSpectatorCanvas: (userId: string, nickname: string, pngBase64: string) => void;
  clearSpectatorCanvases: () => void;
  showGameToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hideGameToast: () => void;
  resetGame: () => void;
}

const DEFAULT_SETTINGS: GameSettings = {
  rounds: 3,
  maxPlayers: 5,
  drawTime: 60,
  wordSource: 'predefined',
  wordCategory: 'Animals',
};

export const useGameStore = create<GameState>((set) => ({
  screen: 'menu',
  roomCode: '',
  isHost: false,
  myId: '',
  myNickname: '',
  players: [],
  settings: { ...DEFAULT_SETTINGS },
  hostId: '',
  currentRound: 0,
  currentTurn: 0,
  totalRounds: 3,
  turnsPerRound: 3,
  pickerId: '',
  pickerName: '',
  role: '',
  wordOptions: [],
  selectedWord: '',
  timerValue: 0,
  turnScores: [],
  leaderboard: [],
  finalScores: [],
  winner: null,
  spectatorCanvases: new Map(),
  gameToast: '',
  gameToastType: 'info',
  gameToastVisible: false,

  setScreen: (screen) => set({ screen }),
  setRoomCode: (roomCode) => set({ roomCode }),
  setIsHost: (isHost) => set({ isHost }),
  setMyId: (myId) => set({ myId }),
  setMyNickname: (myNickname) => set({ myNickname }),
  setPlayers: (players) => set({ players }),
  setSettings: (settings) => set({ settings }),
  setHostId: (hostId) => set({ hostId }),
  setTurnState: (state) => set(state),
  setSelectedWord: (selectedWord) => set({ selectedWord }),
  setTimerValue: (timerValue) => set({ timerValue }),
  setTurnScores: (turnScores) => set({ turnScores }),
  setLeaderboard: (leaderboard) => set({ leaderboard }),
  setFinalScores: (finalScores, winner) => set({ finalScores, winner }),
  updateSpectatorCanvas: (userId, nickname, pngBase64) =>
    set((state) => {
      const newMap = new Map(state.spectatorCanvases);
      newMap.set(userId, { nickname, pngBase64 });
      return { spectatorCanvases: newMap };
    }),
  clearSpectatorCanvases: () => set({ spectatorCanvases: new Map() }),
  showGameToast: (message, type = 'info') =>
    set({ gameToast: message, gameToastType: type, gameToastVisible: true }),
  hideGameToast: () => set({ gameToastVisible: false }),
  resetGame: () =>
    set({
      screen: 'menu',
      roomCode: '',
      isHost: false,
      players: [],
      settings: { ...DEFAULT_SETTINGS },
      currentRound: 0,
      currentTurn: 0,
      pickerId: '',
      pickerName: '',
      role: '',
      wordOptions: [],
      selectedWord: '',
      timerValue: 0,
      turnScores: [],
      leaderboard: [],
      finalScores: [],
      winner: null,
      spectatorCanvases: new Map(),
    }),
}));
