/**
 * Scribble Store — Zustand state for "Scribble" game mode.
 * Completely separate from the Draw This Shytt store and whiteboard store.
 */

import { create } from 'zustand';

export interface ScribblePlayer {
  id: string;
  nickname: string;
  avatar: any;
  totalScore: number;
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
  guessedCorrectly: boolean;
}

export interface ChatMessage {
  id: string;
  nickname: string;
  avatar: any;
  text: string;
  type: 'guess' | 'correct' | 'close' | 'system' | 'chat';
}

export type ScribbleScreen =
  | 'menu'
  | 'lobby'
  | 'waiting'     // Guesser waiting for drawer to pick
  | 'picking'     // Drawer picking word
  | 'countdown'
  | 'drawing'     // Drawer's canvas screen
  | 'guessing'    // Guesser's view + chat
  | 'reveal'
  | 'final';

interface ScribbleState {
  screen: ScribbleScreen;
  roomCode: string;
  isHost: boolean;
  myId: string;
  myNickname: string;

  players: ScribblePlayer[];
  settings: ScribbleSettings;
  hostId: string;

  currentRound: number;
  currentTurn: number;
  totalRounds: number;
  turnsPerRound: number;
  drawerId: string;
  drawerName: string;
  role: 'drawer' | 'guesser' | '';
  wordOptions: string[];      // Only shown to drawer
  secretWord: string;         // Only set for drawer
  blanks: string;             // "_ _ _ _ _" for guessers
  wordLength: number;
  timerValue: number;

  // Chat
  chatMessages: ChatMessage[];
  hasGuessedCorrectly: boolean;
  myTurnPoints: number;       // Points earned this turn (for correct guess feedback)

  // Scores
  turnScores: ScribbleTurnScore[];
  leaderboard: ScribblePlayer[];
  finalScores: ScribblePlayer[];
  winner: ScribblePlayer | null;
  revealedWord: string;

  // Toast
  toast: string;
  toastType: 'success' | 'error' | 'info';
  toastVisible: boolean;

  // Actions
  setScreen: (screen: ScribbleScreen) => void;
  setRoomCode: (code: string) => void;
  setIsHost: (isHost: boolean) => void;
  setMyId: (id: string) => void;
  setMyNickname: (nickname: string) => void;
  setPlayers: (players: ScribblePlayer[]) => void;
  setSettings: (settings: ScribbleSettings) => void;
  setHostId: (id: string) => void;
  setTurnState: (state: Partial<Pick<ScribbleState, 'currentRound' | 'currentTurn' | 'totalRounds' | 'turnsPerRound' | 'drawerId' | 'drawerName' | 'role' | 'wordOptions'>>) => void;
  setSecretWord: (word: string) => void;
  setBlanks: (blanks: string, wordLength: number) => void;
  setTimerValue: (value: number) => void;
  addChatMessage: (msg: ChatMessage) => void;
  setHasGuessedCorrectly: (v: boolean) => void;
  setMyTurnPoints: (v: number) => void;
  setTurnScores: (scores: ScribbleTurnScore[]) => void;
  setLeaderboard: (board: ScribblePlayer[]) => void;
  setFinalScores: (scores: ScribblePlayer[], winner: ScribblePlayer | null) => void;
  setRevealedWord: (word: string) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hideToast: () => void;
  resetScribble: () => void;
}

const DEFAULT_SETTINGS: ScribbleSettings = {
  rounds: 3,
  maxPlayers: 8,
  drawTime: 80,
  wordSource: 'predefined',
  wordCategory: 'Animals',
};

export const useScribbleStore = create<ScribbleState>((set) => ({
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
  drawerId: '',
  drawerName: '',
  role: '',
  wordOptions: [],
  secretWord: '',
  blanks: '',
  wordLength: 0,
  timerValue: 0,
  chatMessages: [],
  hasGuessedCorrectly: false,
  myTurnPoints: 0,
  turnScores: [],
  leaderboard: [],
  finalScores: [],
  winner: null,
  revealedWord: '',
  toast: '',
  toastType: 'info',
  toastVisible: false,

  setScreen: (screen) => set({ screen }),
  setRoomCode: (roomCode) => set({ roomCode }),
  setIsHost: (isHost) => set({ isHost }),
  setMyId: (myId) => set({ myId }),
  setMyNickname: (myNickname) => set({ myNickname }),
  setPlayers: (players) => set({ players }),
  setSettings: (settings) => set({ settings }),
  setHostId: (hostId) => set({ hostId }),
  setTurnState: (state) => set(state),
  setSecretWord: (secretWord) => set({ secretWord }),
  setBlanks: (blanks, wordLength) => set({ blanks, wordLength }),
  setTimerValue: (timerValue) => set({ timerValue }),
  addChatMessage: (msg) => set((state) => ({
    chatMessages: [...state.chatMessages.slice(-100), msg], // Keep last 100 messages
  })),
  setHasGuessedCorrectly: (hasGuessedCorrectly) => set({ hasGuessedCorrectly }),
  setMyTurnPoints: (myTurnPoints) => set({ myTurnPoints }),
  setTurnScores: (turnScores) => set({ turnScores }),
  setLeaderboard: (leaderboard) => set({ leaderboard }),
  setFinalScores: (finalScores, winner) => set({ finalScores, winner }),
  setRevealedWord: (revealedWord) => set({ revealedWord }),
  showToast: (message, type = 'info') =>
    set({ toast: message, toastType: type, toastVisible: true }),
  hideToast: () => set({ toastVisible: false }),
  resetScribble: () =>
    set({
      screen: 'menu',
      roomCode: '',
      isHost: false,
      players: [],
      settings: { ...DEFAULT_SETTINGS },
      currentRound: 0,
      currentTurn: 0,
      drawerId: '',
      drawerName: '',
      role: '',
      wordOptions: [],
      secretWord: '',
      blanks: '',
      wordLength: 0,
      timerValue: 0,
      chatMessages: [],
      hasGuessedCorrectly: false,
      myTurnPoints: 0,
      turnScores: [],
      leaderboard: [],
      finalScores: [],
      winner: null,
      revealedWord: '',
    }),
}));
