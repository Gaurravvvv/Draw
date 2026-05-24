/**
 * Scribble Socket Handlers — "Scribble" game mode.
 * Completely separate from Draw This Shytt and whiteboard handlers.
 */

import { Server, Socket } from 'socket.io';
import {
  scribbleRooms,
  createScribbleRoom,
  addScribblePlayer,
  removeScribblePlayer,
  pickNextDrawer,
  getScribbleLobbyState,
  getScribbleLeaderboard,
  levenshtein,
  calculateGuessPoints,
  generateBlanks,
  type ScribblePlayer,
  type ScribbleSettings,
} from '../game/scribbleState';
import { getRandomWords } from '../game/wordLists';
import { startTimer, startCountdown } from '../game/timer';

// Generate a short room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Groq word generation (reused from Draw This Shytt)
async function generateAIWords(): Promise<string[]> {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
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
    console.error('[Scribble] Groq API error:', err);
  }

  return getRandomWords('Objects', 3);
}

/**
 * Run one turn of Scribble: pick word → draw+guess → reveal
 */
async function runScribbleTurn(io: Server, roomCode: string) {
  const room = scribbleRooms[roomCode];
  if (!room || room.state === 'ended') return;

  // ── 1. Pick drawer ──
  const drawerId = pickNextDrawer(room);
  room.currentDrawerId = drawerId;
  room.drawerHistory.push(drawerId);
  room.state = 'picking';
  room.correctGuessers = new Map();
  room.turnScores = [];
  room.drawHistory = [];
  room.revealedIndices = new Set();

  // ── 2. Generate word options ──
  let words: string[];
  if (room.settings.wordSource === 'ai') {
    words = await generateAIWords();
  } else {
    words = getRandomWords(room.settings.wordCategory, 3);
  }
  room.wordOptions = words;

  const drawerPlayer = room.players.get(drawerId);

  // To drawer: show words
  io.to(drawerId).emit('scribble-turn-started', {
    round: room.currentRound,
    turn: room.currentTurn,
    drawerId,
    drawerName: drawerPlayer?.nickname || 'Unknown',
    role: 'drawer',
    words,
  });

  // To everyone else: waiting screen
  for (const [id] of room.players) {
    if (id !== drawerId) {
      io.to(id).emit('scribble-turn-started', {
        round: room.currentRound,
        turn: room.currentTurn,
        drawerId,
        drawerName: drawerPlayer?.nickname || 'Unknown',
        role: 'guesser',
      });
    }
  }

  // ── 3. Word pick phase (15 seconds) ──
  let wordPicked = false;

  const wordPickPromise = new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      if (!wordPicked) {
        room.currentWord = words[Math.floor(Math.random() * words.length)];
        wordPicked = true;
        resolve();
      }
    }, 15000);

    const drawerSocket = io.sockets.sockets.get(drawerId);
    if (drawerSocket) {
      const handler = (data: { word: string }) => {
        if (wordPicked) return;
        room.currentWord = words.includes(data.word) ? data.word : words[0];
        wordPicked = true;
        clearTimeout(timeout);
        drawerSocket.removeListener('scribble-word-picked', handler);
        resolve();
      };
      drawerSocket.on('scribble-word-picked', handler);
      setTimeout(() => drawerSocket.removeListener('scribble-word-picked', handler), 16000);
    } else {
      room.currentWord = words[0];
      wordPicked = true;
      clearTimeout(timeout);
      resolve();
    }
  });

  const pickTimer = startTimer(io, roomCode, 15, undefined, undefined, 'scribble');
  await wordPickPromise;
  pickTimer.stop();

  if (!scribbleRooms[roomCode] || (scribbleRooms[roomCode].state as string) === 'ended') return;

  // ── 4. Drawing countdown (3...2...1) ──
  const blanks = generateBlanks(room.currentWord, room.revealedIndices);

  io.to(`scribble:${roomCode}`).emit('scribble-word-selected', {
    drawerId,
    drawerName: drawerPlayer?.nickname || 'Unknown',
    blanks,
    wordLength: room.currentWord.length,
  });

  // Show the actual word to the drawer
  io.to(drawerId).emit('scribble-drawer-word', { word: room.currentWord });

  await startCountdown(io, roomCode, 3, 'scribble-countdown', 'scribble');

  if (!scribbleRooms[roomCode] || (scribbleRooms[roomCode].state as string) === 'ended') return;

  // ── 5. Drawing phase ──
  room.state = 'drawing';
  io.to(`scribble:${roomCode}`).emit('scribble-drawing-started', {
    drawTime: room.settings.drawTime,
  });

  // Start hint timer — reveal one letter every 20 seconds
  const wordChars = room.currentWord.split('').map((ch, i) => ({ ch, i })).filter(c => c.ch !== ' ');
  room.hintTimer = setInterval(() => {
    if (!scribbleRooms[roomCode] || room.state !== 'drawing') {
      if (room.hintTimer) clearInterval(room.hintTimer);
      return;
    }

    // Find unrevealed indices
    const unrevealed = wordChars.filter(c => !room.revealedIndices.has(c.i));
    if (unrevealed.length <= 1) return; // Don't reveal the last letter

    const pick = unrevealed[Math.floor(Math.random() * unrevealed.length)];
    room.revealedIndices.add(pick.i);

    const newBlanks = generateBlanks(room.currentWord, room.revealedIndices);
    io.to(`scribble:${roomCode}`).emit('scribble-hint', { blanks: newBlanks });
  }, 20000);

  // Start drawing timer
  await new Promise<void>((resolve) => {
    room.activeTimer = startTimer(
      io,
      roomCode,
      room.settings.drawTime,
      undefined,
      () => resolve(),
      'scribble',
    );

    // Also store resolve so we can end early when all guess correctly
    (room as any)._endDrawingPhase = () => {
      if (room.activeTimer) {
        room.activeTimer.stop();
        room.activeTimer = null;
      }
      resolve();
    };
  });

  if (!scribbleRooms[roomCode]) return;

  // Clean up hint timer
  if (room.hintTimer) {
    clearInterval(room.hintTimer);
    room.hintTimer = null;
  }

  // ── 6. Turn ended ──
  room.state = 'reveal';
  delete (room as any)._endDrawingPhase;

  // Calculate drawer score: 10 × number of correct guessers
  const drawerScore = room.correctGuessers.size * 10;
  if (drawerPlayer) {
    drawerPlayer.totalScore += drawerScore;
  }

  // Build turn scores
  const turnScores: { playerId: string; nickname: string; points: number; guessedCorrectly: boolean }[] = [];

  // Drawer entry
  turnScores.push({
    playerId: drawerId,
    nickname: drawerPlayer?.nickname || 'Unknown',
    points: drawerScore,
    guessedCorrectly: false,
  });

  // Guesser entries
  for (const [id, player] of room.players) {
    if (id === drawerId) continue;
    const storedPoints = room.correctGuessers.get(id);
    const points = storedPoints !== undefined ? storedPoints : 0;
    turnScores.push({
      playerId: id,
      nickname: player.nickname,
      points,
      guessedCorrectly: room.correctGuessers.has(id),
    });
  }

  const leaderboard = getScribbleLeaderboard(room);

  io.to(`scribble:${roomCode}`).emit('scribble-turn-ended', {
    word: room.currentWord,
    scores: turnScores,
    leaderboard,
    round: room.currentRound,
    turn: room.currentTurn,
  });

  // ── 7. Advance or end ──
  const turnsPerRound = room.players.size; // Each player draws once per round
  const isLastTurn = room.currentTurn >= turnsPerRound;
  const isLastRound = room.currentRound >= room.settings.rounds;
  const isGameOver = isLastTurn && isLastRound;

  if (!isGameOver) {
    // 8-second countdown before next turn
    await new Promise<void>((resolve) => {
      room.activeTimer = startTimer(io, roomCode, 8, undefined, () => resolve(), 'scribble');
    });

    if (!scribbleRooms[roomCode]) return;
    room.activeTimer = null;

    if (isLastTurn) {
      room.currentRound++;
      room.currentTurn = 1;
    } else {
      room.currentTurn++;
    }

    runScribbleTurn(io, roomCode);
  } else {
    room.state = 'ended';
    const finalLeaderboard = getScribbleLeaderboard(room);
    io.to(`scribble:${roomCode}`).emit('scribble-game-ended', {
      finalScores: finalLeaderboard,
      winner: finalLeaderboard[0] || null,
    });
  }
}

export function registerScribbleSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    const scribbleSocketRooms = new Set<string>();

    // ── Create scribble room ──
    socket.on('create-scribble-room', (data: { settings: Partial<ScribbleSettings>; nickname: string; avatar: any }) => {
      const roomCode = generateRoomCode();
      const room = createScribbleRoom(roomCode, socket.id, data.settings);

      const player: ScribblePlayer = {
        id: socket.id,
        nickname: data.nickname || 'Host',
        avatar: data.avatar,
        totalScore: 0,
        hasBeenDrawer: false,
      };
      addScribblePlayer(roomCode, player);

      socket.join(`scribble:${roomCode}`);
      scribbleSocketRooms.add(roomCode);

      socket.emit('scribble-room-created', { roomCode });
      io.to(`scribble:${roomCode}`).emit('scribble-lobby-state', getScribbleLobbyState(room));
    });

    // ── Join scribble room ──
    socket.on('join-scribble-room', (data: { roomCode: string; nickname: string; avatar: any }) => {
      const roomCode = data.roomCode.toUpperCase();
      const room = scribbleRooms[roomCode];

      if (!room) {
        socket.emit('scribble-error', { message: 'Room not found!' });
        return;
      }
      if (room.state !== 'lobby') {
        socket.emit('scribble-error', { message: 'Game already in progress!' });
        return;
      }
      if (room.players.size >= room.settings.maxPlayers) {
        socket.emit('scribble-error', { message: 'Room is full!' });
        return;
      }

      const player: ScribblePlayer = {
        id: socket.id,
        nickname: data.nickname || 'Player',
        avatar: data.avatar,
        totalScore: 0,
        hasBeenDrawer: false,
      };

      const success = addScribblePlayer(roomCode, player);
      if (!success) {
        socket.emit('scribble-error', { message: 'Could not join room.' });
        return;
      }

      socket.join(`scribble:${roomCode}`);
      scribbleSocketRooms.add(roomCode);

      socket.emit('scribble-joined', { roomCode });
      io.to(`scribble:${roomCode}`).emit('scribble-lobby-state', getScribbleLobbyState(room));
    });

    // ── Update settings ──
    socket.on('update-scribble-settings', (data: { roomCode: string; settings: Partial<ScribbleSettings> }) => {
      const room = scribbleRooms[data.roomCode];
      if (!room || room.hostId !== socket.id || room.state !== 'lobby') return;
      Object.assign(room.settings, data.settings);
      io.to(`scribble:${data.roomCode}`).emit('scribble-lobby-state', getScribbleLobbyState(room));
    });

    // ── Start game ──
    socket.on('start-scribble', (data: { roomCode: string }) => {
      const room = scribbleRooms[data.roomCode];
      if (!room || room.hostId !== socket.id || room.state !== 'lobby') return;
      if (room.players.size < 2) {
        socket.emit('scribble-error', { message: 'Need at least 2 players to start!' });
        return;
      }

      room.currentRound = 1;
      room.currentTurn = 1;

      io.to(`scribble:${data.roomCode}`).emit('scribble-started', {
        totalRounds: room.settings.rounds,
        turnsPerRound: room.players.size,
      });

      runScribbleTurn(io, data.roomCode);
    });

    // ── Drawing events (drawer only → broadcast to guessers) ──
    socket.on('scribble-draw-event', (data: { roomCode: string; drawData: any }) => {
      const room = scribbleRooms[data.roomCode];
      if (!room || room.state !== 'drawing' || socket.id !== room.currentDrawerId) return;

      // Store in history for late-joiner sync
      room.drawHistory.push(data.drawData);

      // Broadcast to all others in the room
      socket.to(`scribble:${data.roomCode}`).emit('scribble-draw-event', {
        drawData: data.drawData,
      });
    });

    socket.on('scribble-stroke-live', (data: { roomCode: string; strokeData: any }) => {
      const room = scribbleRooms[data.roomCode];
      if (!room || room.state !== 'drawing' || socket.id !== room.currentDrawerId) return;

      socket.to(`scribble:${data.roomCode}`).emit('scribble-stroke-live', {
        strokeData: data.strokeData,
      });
    });

    // ── Guess submission ──
    socket.on('scribble-guess', (data: { roomCode: string; guess: string }) => {
      const room = scribbleRooms[data.roomCode];
      if (!room || room.state !== 'drawing') return;
      if (socket.id === room.currentDrawerId) return; // Drawer can't guess
      if (room.correctGuessers.has(socket.id)) return; // Already guessed correctly

      const player = room.players.get(socket.id);
      if (!player) return;

      const guess = data.guess.trim().toLowerCase();
      const word = room.currentWord.toLowerCase();

      if (guess === word) {
        // ── Correct! ──
        const guessOrder = room.correctGuessers.size;
        const timeRemaining = room.activeTimer?.remaining || 0;
        const points = calculateGuessPoints(guessOrder, timeRemaining, room.settings.drawTime);
        room.correctGuessers.set(socket.id, points);
        player.totalScore += points;

        // Tell the guesser they're correct
        io.to(socket.id).emit('scribble-correct-guess', { points });

        // Tell everyone else (except revealing the word)
        io.to(`scribble:${data.roomCode}`).emit('scribble-chat', {
          nickname: player.nickname,
          avatar: player.avatar,
          text: `${player.nickname} guessed the word! 🎉`,
          type: 'correct',
        });

        // Tell the drawer
        io.to(room.currentDrawerId).emit('scribble-chat', {
          nickname: 'System',
          avatar: null,
          text: `${player.nickname} guessed correctly! (+${points} pts)`,
          type: 'system',
        });

        // Check if all guessers have guessed
        const guesserCount = room.players.size - 1;
        if (room.correctGuessers.size >= guesserCount) {
          // End the turn early
          const endFn = (room as any)._endDrawingPhase;
          if (endFn) endFn();
        }
      } else {
        // Check for close guess
        const dist = levenshtein(guess, word);
        if (dist <= 2 && dist > 0 && guess.length >= word.length - 2) {
          // Close guess — tell only the guesser
          io.to(socket.id).emit('scribble-chat', {
            nickname: 'System',
            avatar: null,
            text: 'Almost! 🔥',
            type: 'close',
          });

          // Show to drawer as "guessing..."
          io.to(room.currentDrawerId).emit('scribble-chat', {
            nickname: player.nickname,
            avatar: player.avatar,
            text: `${player.nickname} is close...`,
            type: 'system',
          });

          // Show to other guessers as regular guess (but not the word)
          for (const [id] of room.players) {
            if (id !== socket.id && id !== room.currentDrawerId) {
              io.to(id).emit('scribble-chat', {
                nickname: player.nickname,
                avatar: player.avatar,
                text: data.guess,
                type: 'guess',
              });
            }
          }
        } else {
          // Wrong guess — show to everyone except drawer
          for (const [id] of room.players) {
            if (id !== room.currentDrawerId) {
              io.to(id).emit('scribble-chat', {
                nickname: player.nickname,
                avatar: player.avatar,
                text: data.guess,
                type: 'guess',
              });
            }
          }

          // Drawer sees "is guessing..."
          io.to(room.currentDrawerId).emit('scribble-chat', {
            nickname: player.nickname,
            avatar: player.avatar,
            text: `${player.nickname} is guessing...`,
            type: 'system',
          });
        }
      }
    });

    // ── Leave scribble ──
    socket.on('leave-scribble', (data: { roomCode: string }) => {
      handleLeaveScribble(io, socket, data.roomCode, scribbleSocketRooms);
    });

    // ── Disconnect ──
    socket.on('disconnect', () => {
      for (const roomCode of scribbleSocketRooms) {
        handleLeaveScribble(io, socket, roomCode, scribbleSocketRooms);
      }
      scribbleSocketRooms.clear();
    });
  });
}

function handleLeaveScribble(io: Server, socket: Socket, roomCode: string, scribbleSocketRooms: Set<string>) {
  const room = scribbleRooms[roomCode];
  if (!room) return;

  socket.leave(`scribble:${roomCode}`);
  scribbleSocketRooms.delete(roomCode);
  removeScribblePlayer(roomCode, socket.id);

  if (scribbleRooms[roomCode]) {
    io.to(`scribble:${roomCode}`).emit('scribble-lobby-state', getScribbleLobbyState(room));
    io.to(`scribble:${roomCode}`).emit('scribble-player-left', { playerId: socket.id });
  }
}
