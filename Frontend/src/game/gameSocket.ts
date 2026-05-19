/**
 * useGameSocket — Socket.io hook for "Draw This Shytt" game mode.
 * Completely separate from the whiteboard socket.
 */

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from './gameStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function useGameSocket() {
  const socketRef = useRef<Socket | null>(null);
  const store = useGameStore();

  useEffect(() => {
    const socket = io(API_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      store.setMyId(socket.id || '');
    });

    // ── Room created ──
    socket.on('game-room-created', (data: { roomCode: string }) => {
      store.setRoomCode(data.roomCode);
      store.setIsHost(true);
      store.setScreen('lobby');
    });

    // ── Room joined ──
    socket.on('game-joined', (data: { roomCode: string }) => {
      store.setRoomCode(data.roomCode);
      store.setScreen('lobby');
    });

    // ── Lobby state updates ──
    socket.on('game-lobby-state', (data: any) => {
      store.setPlayers(data.players || []);
      store.setSettings(data.settings);
      store.setHostId(data.hostId);
      store.setIsHost(socket.id === data.hostId);
    });

    // ── Game started ──
    socket.on('game-started', (data: { totalRounds: number; turnsPerRound: number }) => {
      store.setTurnState({
        totalRounds: data.totalRounds,
        turnsPerRound: data.turnsPerRound,
      });
    });

    // ── Turn started ──
    socket.on('turn-started', (data: any) => {
      store.setTurnState({
        currentRound: data.round,
        currentTurn: data.turn,
        pickerId: data.pickerId,
        pickerName: data.pickerName,
        role: data.role,
        wordOptions: data.words || [],
      });
      store.clearSpectatorCanvases();

      if (data.role === 'picker') {
        store.setScreen('picking');
      } else {
        store.setScreen('waiting');
      }
    });

    // ── Word selected (transition to countdown for everyone) ──
    socket.on('word-selected', () => {
      // Everyone (including picker) goes to countdown screen
      store.setScreen('countdown');
    });

    // ── Drawing countdown ──
    socket.on('drawing-countdown', (data: { count: number }) => {
      store.setTimerValue(data.count);
      if (useGameStore.getState().screen !== 'countdown' && useGameStore.getState().role !== 'picker') {
        store.setScreen('countdown');
      }
    });

    // ── Timer ticks ──
    socket.on('timer-tick', (data: { remaining: number }) => {
      store.setTimerValue(data.remaining);
    });

    // ── Drawing started ──
    socket.on('drawing-started', () => {
      const role = useGameStore.getState().role;
      if (role === 'picker') {
        store.setScreen('spectating');
      } else {
        store.setScreen('drawing');
      }
    });

    // ── Drawing ended ──
    // IMPORTANT: We must signal DrawingScreen to export BEFORE unmounting it.
    // If we set screen='scoring' immediately, React unmounts DrawingScreen,
    // which cleans up window.__gameCanvasExport — so the export is impossible.
    // Solution: fire a custom event first, then delay the screen transition.
    socket.on('drawing-ended', () => {
      const role = useGameStore.getState().role;
      if (role !== 'picker') {
        // Signal DrawingScreen to export NOW (while still mounted)
        window.dispatchEvent(new CustomEvent('game-drawing-ended'));
        // Give it 400ms to complete the export + HTTP request before unmounting
        setTimeout(() => store.setScreen('scoring'), 400);
      } else {
        // Picker (spectator) has no canvas to export — transition immediately
        store.setScreen('scoring');
      }
    });

    // ── Spectator canvas updates ──
    socket.on('spectator-canvas', (data: { fromUser: string; fromNickname: string; pngBase64: string }) => {
      store.updateSpectatorCanvas(data.fromUser, data.fromNickname, data.pngBase64);
    });

    // ── Spectator live strokes ──
    socket.on('spectator-stroke', (data: any) => {
      window.dispatchEvent(new CustomEvent('spectator-stroke', { detail: data }));
    });

    // ── Turn scores revealed ──
    socket.on('turn-scores', (data: { word: string; scores: any[]; leaderboard: any[]; round: number; turn: number }) => {
      store.setSelectedWord(data.word);
      store.setTurnScores(data.scores);
      store.setLeaderboard(data.leaderboard);
      store.setScreen('reveal');
    });

    // ── Next turn countdown ──
    socket.on('next-turn-countdown', (data: { remaining: number }) => {
      store.setTimerValue(data.remaining);
    });

    // ── Game ended ──
    socket.on('game-ended', (data: { finalScores: any[]; winner: any }) => {
      store.setFinalScores(data.finalScores, data.winner);
      store.setScreen('final');
    });

    // ── Errors ──
    socket.on('game-error', (data: { message: string }) => {
      store.showGameToast(data.message, 'error');
    });

    // ── Player left ──
    socket.on('player-left-game', (data: { playerId: string }) => {
      store.setPlayers(useGameStore.getState().players.filter(p => p.id !== data.playerId));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // ── Emit helpers ──

  const createRoom = useCallback((nickname: string, avatar: any, settings: any) => {
    socketRef.current?.emit('create-game-room', { nickname, avatar, settings });
  }, []);

  const joinRoom = useCallback((roomCode: string, nickname: string, avatar: any) => {
    socketRef.current?.emit('join-game-room', { roomCode, nickname, avatar });
  }, []);

  const updateSettings = useCallback((roomCode: string, settings: any) => {
    socketRef.current?.emit('update-game-settings', { roomCode, settings });
  }, []);

  const startGame = useCallback((roomCode: string) => {
    socketRef.current?.emit('start-game', { roomCode });
  }, []);

  const pickWord = useCallback((word: string) => {
    socketRef.current?.emit('word-picked', { word });
    // Store locally so the spectator screen can display the word
    useGameStore.getState().setSelectedWord(word);
  }, []);

  const sendCanvasSnapshot = useCallback((roomCode: string, pngBase64: string) => {
    socketRef.current?.emit('game-canvas-snapshot', { roomCode, pngBase64 });
  }, []);

  const sendStrokeLive = useCallback((roomCode: string, strokeData: any) => {
    socketRef.current?.emit('game-stroke-live', { roomCode, strokeData });
  }, []);

  const submitDrawing = useCallback((roomCode: string, pngBase64: string) => {
    socketRef.current?.emit('submit-drawing', { roomCode, pngBase64 });
  }, []);

  const leaveGame = useCallback((roomCode: string) => {
    socketRef.current?.emit('leave-game', { roomCode });
    store.resetGame();
  }, []);

  return {
    socketRef,
    createRoom,
    joinRoom,
    updateSettings,
    startGame,
    pickWord,
    sendCanvasSnapshot,
    sendStrokeLive,
    submitDrawing,
    leaveGame,
  };
}
