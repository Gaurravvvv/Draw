/**
 * Game Socket Handlers — "Draw This Shytt" game mode.
 * Completely separate from whiteboard socket handlers.
 */

import { Server, Socket } from 'socket.io';
import {
  gameRooms,
  createGameRoom,
  addPlayer,
  removePlayer,
  pickNextPicker,
  getGameLobbyState,
  getLeaderboard,
  type GamePlayer,
  type GameSettings,
} from '../game/gameState';
import { getRandomWords, WORD_CATEGORIES } from '../game/wordLists';
import { startTimer, startCountdown } from '../game/timer';

// Generate a short room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Groq word generation
async function generateAIWords(): Promise<string[]> {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    console.warn('[Game] No GROQ_API_KEY set, falling back to predefined words');
    return getRandomWords('Objects', 3);
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'user',
            content: 'Give me 3 simple, drawable, single English words suitable for a drawing game. Return only a JSON array of 3 strings, no explanation.',
          },
        ],
        temperature: 1.0,
        max_tokens: 50,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    const words = JSON.parse(content);

    if (Array.isArray(words) && words.length >= 3) {
      return words.slice(0, 3).map((w: string) => w.toLowerCase().trim());
    }
  } catch (err) {
    console.error('[Game] Groq API error:', err);
  }

  // Fallback
  return getRandomWords('Objects', 3);
}

/**
 * Run one turn of the game: pick word → draw → score → reveal
 */
async function runTurn(io: Server, roomCode: string) {
  const room = gameRooms[roomCode];
  if (!room || room.state === 'ended') return;

  // ── 1. Pick a random picker ──
  const pickerId = pickNextPicker(room);
  room.currentPickerId = pickerId;
  room.pickerHistory.push(pickerId);
  room.state = 'picking';
  room.turnDrawings.clear();
  room.turnScores = [];

  // ── 2. Generate word options ──
  let words: string[];
  if (room.settings.wordSource === 'ai') {
    words = await generateAIWords();
  } else {
    words = getRandomWords(room.settings.wordCategory, 3);
  }
  room.wordOptions = words;

  // Emit turn-started to all
  const pickerPlayer = room.players.get(pickerId);

  // To picker: show words
  io.to(pickerId).emit('turn-started', {
    round: room.currentRound,
    turn: room.currentTurn,
    pickerId,
    pickerName: pickerPlayer?.nickname || 'Unknown',
    role: 'picker',
    words,
  });

  // To everyone else: show waiting screen
  for (const [id] of room.players) {
    if (id !== pickerId) {
      io.to(id).emit('turn-started', {
        round: room.currentRound,
        turn: room.currentTurn,
        pickerId,
        pickerName: pickerPlayer?.nickname || 'Unknown',
        role: 'drawer',
      });
    }
  }

  // ── 3. Word pick phase (15 seconds) ──
  room.state = 'picking';
  let wordPicked = false;

  // Set up a one-time listener for the picker's choice
  const wordPickPromise = new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      if (!wordPicked) {
        // Auto-select random word
        const randomWord = words[Math.floor(Math.random() * words.length)];
        room.currentWord = randomWord;
        wordPicked = true;
        resolve();
      }
    }, 15000);

    // Listen for pick from the picker
    const pickerSocket = io.sockets.sockets.get(pickerId);
    if (pickerSocket) {
      const handler = (data: { word: string }) => {
        if (wordPicked) return;
        if (words.includes(data.word)) {
          room.currentWord = data.word;
        } else {
          room.currentWord = words[0];
        }
        wordPicked = true;
        clearTimeout(timeout);
        pickerSocket.removeListener('word-picked', handler);
        resolve();
      };
      pickerSocket.on('word-picked', handler);

      // Clean up listener if timeout fires first
      const origResolve = resolve;
      setTimeout(() => {
        pickerSocket.removeListener('word-picked', handler);
      }, 16000);
    } else {
      // Picker disconnected, auto-pick
      room.currentWord = words[0];
      wordPicked = true;
      clearTimeout(timeout);
      resolve();
    }
  });

  // Start the pick timer
  const pickTimer = startTimer(io, roomCode, 15, undefined, undefined);
  
  await wordPickPromise;
  pickTimer.stop();

  // Check if room still exists (state may have changed during await)
  if (!gameRooms[roomCode] || (gameRooms[roomCode].state as string) === 'ended') return;

  // ── 4. Drawing countdown (3...2...1) ──
  io.to(`game:${roomCode}`).emit('word-selected', {
    pickerId,
    pickerName: pickerPlayer?.nickname || 'Unknown',
  });

  await startCountdown(io, roomCode, 3, 'drawing-countdown');

  // Check room again (state may have changed during countdown)
  if (!gameRooms[roomCode] || (gameRooms[roomCode].state as string) === 'ended') return;

  // ── 5. Drawing phase ──
  room.state = 'drawing';
  io.to(`game:${roomCode}`).emit('drawing-started', {
    drawTime: room.settings.drawTime,
  });

  // Start drawing timer
  await new Promise<void>((resolve) => {
    room.activeTimer = startTimer(
      io,
      roomCode,
      room.settings.drawTime,
      undefined,
      () => resolve(),
    );
  });

  // Check room again
  if (!gameRooms[roomCode]) return;

  // ── 6. Drawing ended — lock canvases ──
  room.state = 'scoring';
  room.activeTimer = null;
  io.to(`game:${roomCode}`).emit('drawing-ended', {});

  // ── 7. Wait for drawings to be submitted (give 5 seconds for upload) ──
  await new Promise<void>((resolve) => setTimeout(resolve, 5000));

  if (!gameRooms[roomCode]) return;

  // ── 8. Score with Gemini and reveal ──
  // Scoring happens via HTTP POST, collected in turnDrawings map
  // Now emit all scores
  const scores = room.turnScores;

  // Add scores to cumulative totals
  for (const score of scores) {
    const player = room.players.get(score.playerId);
    if (player) {
      player.totalScore += score.score;
    }
  }

  room.state = 'reveal';
  const leaderboard = getLeaderboard(room);

  io.to(`game:${roomCode}`).emit('turn-scores', {
    word: room.currentWord,
    scores: scores.map(s => ({
      playerId: s.playerId,
      nickname: s.nickname,
      score: s.score,
      drawingPng: s.drawingPng,
    })),
    leaderboard,
    round: room.currentRound,
    turn: room.currentTurn,
  });

  // ── 9. 10-second countdown before next turn ──
  const turnsPerRound = 3;
  const isLastTurn = room.currentTurn >= turnsPerRound;
  const isLastRound = room.currentRound >= room.settings.rounds;
  const isGameOver = isLastTurn && isLastRound;

  if (!isGameOver) {
    // 10-second countdown
    await new Promise<void>((resolve) => {
      room.activeTimer = startTimer(io, roomCode, 10, undefined, () => resolve());
    });

    if (!gameRooms[roomCode]) return;
    room.activeTimer = null;

    // Advance turn
    if (isLastTurn) {
      room.currentRound++;
      room.currentTurn = 1;
    } else {
      room.currentTurn++;
    }

    // Start next turn
    runTurn(io, roomCode);
  } else {
    // Game over!
    room.state = 'ended';
    const finalLeaderboard = getLeaderboard(room);
    io.to(`game:${roomCode}`).emit('game-ended', {
      finalScores: finalLeaderboard,
      winner: finalLeaderboard[0] || null,
    });
  }
}

export function registerGameSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    // Track game rooms this socket is in
    const gameSocketRooms = new Set<string>();

    // ── Create game room ──
    socket.on('create-game-room', (data: { settings: Partial<GameSettings>; nickname: string; avatar: any }) => {
      const roomCode = generateRoomCode();
      const room = createGameRoom(roomCode, socket.id, data.settings);

      const player: GamePlayer = {
        id: socket.id,
        nickname: data.nickname || 'Host',
        avatar: data.avatar,
        totalScore: 0,
        hasBeenPicker: false,
      };
      addPlayer(roomCode, player);

      socket.join(`game:${roomCode}`);
      gameSocketRooms.add(roomCode);

      socket.emit('game-room-created', { roomCode });
      io.to(`game:${roomCode}`).emit('game-lobby-state', getGameLobbyState(room));
    });

    // ── Join game room ──
    socket.on('join-game-room', (data: { roomCode: string; nickname: string; avatar: any }) => {
      const roomCode = data.roomCode.toUpperCase();
      const room = gameRooms[roomCode];

      if (!room) {
        socket.emit('game-error', { message: 'Game room not found!' });
        return;
      }

      if (room.state !== 'lobby') {
        socket.emit('game-error', { message: 'Game already in progress!' });
        return;
      }

      if (room.players.size >= room.settings.maxPlayers) {
        socket.emit('game-error', { message: 'Game room is full!' });
        return;
      }

      const player: GamePlayer = {
        id: socket.id,
        nickname: data.nickname || 'Player',
        avatar: data.avatar,
        totalScore: 0,
        hasBeenPicker: false,
      };

      const success = addPlayer(roomCode, player);
      if (!success) {
        socket.emit('game-error', { message: 'Could not join game room.' });
        return;
      }

      socket.join(`game:${roomCode}`);
      gameSocketRooms.add(roomCode);

      socket.emit('game-joined', { roomCode });
      io.to(`game:${roomCode}`).emit('game-lobby-state', getGameLobbyState(room));
    });

    // ── Update settings (host only) ──
    socket.on('update-game-settings', (data: { roomCode: string; settings: Partial<GameSettings> }) => {
      const room = gameRooms[data.roomCode];
      if (!room || room.hostId !== socket.id) return;
      if (room.state !== 'lobby') return;

      Object.assign(room.settings, data.settings);
      io.to(`game:${data.roomCode}`).emit('game-lobby-state', getGameLobbyState(room));
    });

    // ── Start game (host only) ──
    socket.on('start-game', (data: { roomCode: string }) => {
      const room = gameRooms[data.roomCode];
      if (!room || room.hostId !== socket.id) return;
      if (room.state !== 'lobby') return;
      if (room.players.size < 2) {
        socket.emit('game-error', { message: 'Need at least 2 players to start!' });
        return;
      }

      room.currentRound = 1;
      room.currentTurn = 1;

      io.to(`game:${data.roomCode}`).emit('game-started', {
        totalRounds: room.settings.rounds,
        turnsPerRound: 3,
      });

      // Start the first turn
      runTurn(io, data.roomCode);
    });

    // ── Game live stroke (during drawing phase) ──
    socket.on('game-stroke-live', (data: { roomCode: string; strokeData: any; }) => {
      const room = gameRooms[data.roomCode];
      if (!room || room.state !== 'drawing') return;

      // Only send to the picker (spectator view)
      if (room.currentPickerId) {
        io.to(room.currentPickerId).emit('spectator-stroke', {
          fromUser: socket.id,
          fromNickname: room.players.get(socket.id)?.nickname || 'Unknown',
          strokeData: data.strokeData,
        });
      }
    });

    // ── Canvas snapshot for spectator (periodic during drawing) ──
    socket.on('game-canvas-snapshot', (data: { roomCode: string; pngBase64: string }) => {
      const room = gameRooms[data.roomCode];
      if (!room || room.state !== 'drawing') return;

      // Forward to picker for spectator view
      if (room.currentPickerId) {
        io.to(room.currentPickerId).emit('spectator-canvas', {
          fromUser: socket.id,
          fromNickname: room.players.get(socket.id)?.nickname || 'Unknown',
          pngBase64: data.pngBase64,
        });
      }
    });

    // ── Submit drawing for scoring ──
    socket.on('submit-drawing', (data: { roomCode: string; pngBase64: string }) => {
      const room = gameRooms[data.roomCode];
      if (!room) return;
      if (socket.id === room.currentPickerId) return; // Picker can't submit

      room.turnDrawings.set(socket.id, data.pngBase64);
    });

    // ── Leave game ──
    socket.on('leave-game', (data: { roomCode: string }) => {
      handleLeaveGame(io, socket, data.roomCode, gameSocketRooms);
    });

    // ── Disconnect ──
    socket.on('disconnect', () => {
      for (const roomCode of gameSocketRooms) {
        handleLeaveGame(io, socket, roomCode, gameSocketRooms);
      }
      gameSocketRooms.clear();
    });
  });
}

function handleLeaveGame(io: Server, socket: Socket, roomCode: string, gameSocketRooms: Set<string>) {
  const room = gameRooms[roomCode];
  if (!room) return;

  socket.leave(`game:${roomCode}`);
  gameSocketRooms.delete(roomCode);
  removePlayer(roomCode, socket.id);

  // If room still exists, broadcast updated state
  if (gameRooms[roomCode]) {
    io.to(`game:${roomCode}`).emit('game-lobby-state', getGameLobbyState(room));
    io.to(`game:${roomCode}`).emit('player-left-game', { playerId: socket.id });
  }
}

export { gameRooms };
