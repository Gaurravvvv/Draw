/**
 * useScribbleSocket — Socket.io hook for "Scribble" game mode.
 * Completely separate from Draw This Shytt and whiteboard sockets.
 */

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useScribbleStore } from './scribbleStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function useScribbleSocket() {
  const socketRef = useRef<Socket | null>(null);
  const store = useScribbleStore();

  useEffect(() => {
    const socket = io(API_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      store.setMyId(socket.id || '');
    });

    // ── Room created ──
    socket.on('scribble-room-created', (data: { roomCode: string }) => {
      store.setRoomCode(data.roomCode);
      store.setIsHost(true);
      store.setScreen('lobby');
    });

    // ── Room joined ──
    socket.on('scribble-joined', (data: { roomCode: string }) => {
      store.setRoomCode(data.roomCode);
      store.setScreen('lobby');
    });

    // ── Lobby state ──
    socket.on('scribble-lobby-state', (data: any) => {
      store.setPlayers(data.players || []);
      store.setSettings(data.settings);
      store.setHostId(data.hostId);
      store.setIsHost(socket.id === data.hostId);
    });

    // ── Game started ──
    socket.on('scribble-started', (data: { totalRounds: number; turnsPerRound: number }) => {
      store.setTurnState({
        totalRounds: data.totalRounds,
        turnsPerRound: data.turnsPerRound,
      });
    });

    // ── Turn started ──
    socket.on('scribble-turn-started', (data: any) => {
      // Clear chat and guess state for new turn
      useScribbleStore.setState({ chatMessages: [], hasGuessedCorrectly: false, myTurnPoints: 0 });

      store.setTurnState({
        currentRound: data.round,
        currentTurn: data.turn,
        drawerId: data.drawerId,
        drawerName: data.drawerName,
        role: data.role,
        wordOptions: data.words || [],
      });

      if (data.role === 'drawer') {
        store.setScreen('picking');
      } else {
        store.setScreen('waiting');
      }
    });

    // ── Word selected (blanks shown to everyone) ──
    socket.on('scribble-word-selected', (data: { blanks: string; wordLength: number }) => {
      store.setBlanks(data.blanks, data.wordLength);
      store.setScreen('countdown');
    });

    // ── Drawer gets actual word ──
    socket.on('scribble-drawer-word', (data: { word: string }) => {
      store.setSecretWord(data.word);
    });

    // ── Countdown ──
    socket.on('scribble-countdown', (data: { count: number }) => {
      store.setTimerValue(data.count);
      const currentScreen = useScribbleStore.getState().screen;
      if (currentScreen !== 'countdown') {
        store.setScreen('countdown');
      }
    });

    // ── Timer ticks ──
    socket.on('timer-tick', (data: { remaining: number }) => {
      store.setTimerValue(data.remaining);
    });

    // ── Drawing started ──
    socket.on('scribble-drawing-started', () => {
      const role = useScribbleStore.getState().role;
      if (role === 'drawer') {
        store.setScreen('drawing');
      } else {
        store.setScreen('guessing');
      }
    });

    // ── Hint (updated blanks) ──
    socket.on('scribble-hint', (data: { blanks: string }) => {
      useScribbleStore.setState({ blanks: data.blanks });
    });

    // ── Chat messages ──
    socket.on('scribble-chat', (data: { nickname: string; avatar: any; text: string; type: string }) => {
      store.addChatMessage({
        id: `${Date.now()}-${Math.random()}`,
        nickname: data.nickname,
        avatar: data.avatar || null,
        text: data.text,
        type: data.type as any,
      });
    });

    // ── Correct guess ──
    socket.on('scribble-correct-guess', (data: { points: number }) => {
      store.setHasGuessedCorrectly(true);
      store.setMyTurnPoints(data.points);
    });

    // ── Draw events from drawer (for guessers) ──
    socket.on('scribble-draw-event', (data: { drawData: any }) => {
      window.dispatchEvent(new CustomEvent('scribble-remote-draw', { detail: data.drawData }));
    });

    socket.on('scribble-stroke-live', (data: { strokeData: any }) => {
      window.dispatchEvent(new CustomEvent('scribble-remote-stroke', { detail: data.strokeData }));
    });

    // ── Turn ended ──
    socket.on('scribble-turn-ended', (data: { word: string; scores: any[]; leaderboard: any[]; round: number; turn: number }) => {
      store.setRevealedWord(data.word);
      store.setTurnScores(data.scores);
      store.setLeaderboard(data.leaderboard);
      store.setScreen('reveal');
    });

    // ── Game ended ──
    socket.on('scribble-game-ended', (data: { finalScores: any[]; winner: any }) => {
      store.setFinalScores(data.finalScores, data.winner);
      store.setScreen('final');
    });

    // ── Errors ──
    socket.on('scribble-error', (data: { message: string }) => {
      store.showToast(data.message, 'error');
    });

    // ── Player left ──
    socket.on('scribble-player-left', (data: { playerId: string }) => {
      store.setPlayers(useScribbleStore.getState().players.filter(p => p.id !== data.playerId));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // ── Emit helpers ──

  const createRoom = useCallback((nickname: string, avatar: any, settings: any) => {
    socketRef.current?.emit('create-scribble-room', { nickname, avatar, settings });
  }, []);

  const joinRoom = useCallback((roomCode: string, nickname: string, avatar: any) => {
    socketRef.current?.emit('join-scribble-room', { roomCode, nickname, avatar });
  }, []);

  const updateSettings = useCallback((roomCode: string, settings: any) => {
    socketRef.current?.emit('update-scribble-settings', { roomCode, settings });
  }, []);

  const startGame = useCallback((roomCode: string) => {
    socketRef.current?.emit('start-scribble', { roomCode });
  }, []);

  const pickWord = useCallback((word: string) => {
    socketRef.current?.emit('scribble-word-picked', { word });
    useScribbleStore.getState().setSecretWord(word);
  }, []);

  const sendDrawEvent = useCallback((roomCode: string, drawData: any) => {
    socketRef.current?.emit('scribble-draw-event', { roomCode, drawData });
  }, []);

  const sendStrokeLive = useCallback((roomCode: string, strokeData: any) => {
    socketRef.current?.emit('scribble-stroke-live', { roomCode, strokeData });
  }, []);

  const sendGuess = useCallback((roomCode: string, guess: string) => {
    socketRef.current?.emit('scribble-guess', { roomCode, guess });
  }, []);

  const leaveScribble = useCallback((roomCode: string) => {
    socketRef.current?.emit('leave-scribble', { roomCode });
    store.resetScribble();
  }, []);

  return {
    socketRef,
    createRoom,
    joinRoom,
    updateSettings,
    startGame,
    pickWord,
    sendDrawEvent,
    sendStrokeLive,
    sendGuess,
    leaveScribble,
  };
}
