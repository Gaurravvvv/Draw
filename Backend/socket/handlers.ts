import { Server, Socket } from 'socket.io';

// --- Raster-architecture room state ---
interface RasterRoomState {
  users: Map<string, { id: string; nickname: string; avatar: any }>;
  /** Command log: ordered list of raster stroke commands */
  commands: any[];
  /** Per-user redo stacks */
  redoStacks: Map<string, any[]>;
  /** Floating text objects overlay */
  texts: any[];
  /** Host of the room (first user to join) */
  hostId: string | null;
  /** Banned socket IDs (temporary, cleared on timer) */
  banned: Set<string>;
  /** Protected base layer commands (locked by host) */
  baseLayerCommands: any[];
}

/** Compact raster stroke command */
interface RasterCommand {
  id: string;
  tool: string;
  color: string;
  size: number;
  opacity: number;
  /** Flat array: [x, y, pressure, x, y, pressure, ...] */
  points: number[];
  isEraser?: boolean;
  isHighlighter?: boolean;
  shadow?: { color: string; blur: number; offsetX?: number; offsetY?: number };
  shape?: { kind: string; x: number; y: number; w: number; h: number };
}

type DrawEvent = 
  | { type: 'stroke'; stroke: RasterCommand }
  | { type: 'fill'; point: { x: number; y: number }; color: string; tolerance: number }
  | { type: 'image'; dataUrl: string; x: number; y: number; w: number; h: number }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'clear' };

// In-memory state per room
export const rooms: Record<string, RasterRoomState> = {};

// Debounced save timers per room
const saveTimers: Record<string, NodeJS.Timeout> = {};

// TTL for empty rooms (30 minutes)
const ROOM_TTL_MS = 30 * 60 * 1000;
const emptyRoomTimers: Record<string, NodeJS.Timeout> = {};

// Max commands kept in memory before truncation
const MAX_COMMANDS = 500;

// B4 FIX: Validate roomId format (alphanumeric, 3-20 chars)
const ROOM_ID_REGEX = /^[A-Za-z0-9]{3,20}$/;

function isValidRoomId(roomId: unknown): roomId is string {
  return typeof roomId === 'string' && ROOM_ID_REGEX.test(roomId);
}

/**
 * Get or initialize room state
 */
function getRoom(roomId: string): RasterRoomState {
  if (!rooms[roomId]) {
    rooms[roomId] = {
      users: new Map(),
      commands: [],
      redoStacks: new Map(),
      texts: [],
      hostId: null,
      banned: new Set(),
      baseLayerCommands: [],
    };
  }
  return rooms[roomId];
}

// Database persistence has been removed for soft-login ephemeral rooms.

/**
 * Schedule cleanup for an empty room after TTL
 */
function scheduleRoomCleanup(roomId: string) {
  if (emptyRoomTimers[roomId]) {
    clearTimeout(emptyRoomTimers[roomId]);
  }

  emptyRoomTimers[roomId] = setTimeout(() => {
    // Only clean up if still empty
    const room = rooms[roomId];
    if (!room || room.users.size === 0) {
      delete rooms[roomId];
      delete emptyRoomTimers[roomId];
      console.log(`Room ${roomId} cleaned up from memory after TTL`);
    }
  }, ROOM_TTL_MS);
}

/**
 * Cancel scheduled cleanup (user rejoined)
 */
function cancelRoomCleanup(roomId: string) {
  if (emptyRoomTimers[roomId]) {
    clearTimeout(emptyRoomTimers[roomId]);
    delete emptyRoomTimers[roomId];
  }
}

export function registerSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log('User connected:', socket.id);

    // B3 FIX: Track ALL rooms this socket is in (not just the last one)
    const socketRooms = new Set<string>();

    socket.on('join-room', async (data: any) => {
      // Support both old string payload and new object payload
      const roomId = typeof data === 'string' ? data : data?.roomId;
      
      // B4 FIX: Validate roomId before processing
      if (!isValidRoomId(roomId)) {
        socket.emit('error', { message: 'Invalid room ID. Use 3-20 alphanumeric characters.' });
        return;
      }

      const isCreating = typeof data === 'object' && data.isCreating === true;

      // Check if room exists when joining (not creating)
      if (!isCreating && !rooms[roomId]) {
        socket.emit('room-not-found', { message: `Room ${roomId} does not exist.` });
        return;
      }

      // Track user in room
      const room = getRoom(roomId);

      // Check ban
      if (room.banned.has(socket.id)) {
        socket.emit('error', { message: 'You have been banned from this room.' });
        return;
      }

      if (room.users.size >= 10 && !room.users.has(socket.id)) {
        socket.emit('error', { message: 'Room is full! Maximum 10 players allowed.' });
        return;
      }

      socket.join(roomId);
      socketRooms.add(roomId);
      console.log(`User ${socket.id} joined room ${roomId}`);
      const nickname = typeof data === 'object' && data.nickname ? data.nickname : 'Anonymous';
      const avatar = typeof data === 'object' && data.avatar ? data.avatar : { baseColor: '#000', eyesId: 0, mouthId: 0 };
      
      room.users.set(socket.id, { id: socket.id, nickname, avatar });
      cancelRoomCleanup(roomId);

      // Set host if first user
      if (!room.hostId || !room.users.has(room.hostId)) {
        room.hostId = socket.id;
      }

      // Load room state (now purely from memory)
      socket.emit('initial-state', {
        commands: room.commands.filter(c => !c.isUndone),
        texts: room.texts,
        baseLayerCommands: room.baseLayerCommands,
      });
      
      // Broadcast updated user list with host info
      io.in(roomId).emit('room-users', {
        users: Array.from(room.users.values()),
        hostId: room.hostId,
      });
    });

    // Handle raster draw events — append command to log & broadcast
    socket.on('draw-event', ({ roomId, data }: { roomId: unknown; data: DrawEvent }) => {
      // B4 FIX: Validate roomId
      if (!isValidRoomId(roomId)) return;

      // B5 FIX: Verify this socket is actually in the room
      if (!socket.rooms.has(roomId)) return;

      const room = getRoom(roomId);

      if (data.type === 'stroke' || data.type === 'fill' || data.type === 'image') {
        // Tag with author for user-scoped undo
        (data as any).authorId = socket.id;
        // Remove permanently any undone commands for this user before pushing a new one
        room.commands = room.commands.filter(c => !(c.authorId === socket.id && c.isUndone));
        
        // Clear this user's redo stack on new action
        room.redoStacks.set(socket.id, []);
        // Store the entire event in commands array
        room.commands.push(data as any);

        // Truncate command log if too large
        if (room.commands.length > MAX_COMMANDS) {
          room.commands = room.commands.slice(-MAX_COMMANDS);
        }
      } else if (data.type === 'undo') {
        // USER-SCOPED UNDO: find the last active (not undone) command by this user
        let foundIndex = -1;
        for (let i = room.commands.length - 1; i >= 0; i--) {
          if ((room.commands[i] as any).authorId === socket.id && !(room.commands[i] as any).isUndone) {
            foundIndex = i;
            break;
          }
        }
        if (foundIndex === -1) return; // Nothing to undo for this user

        // Mark as undone instead of removing, to preserve z-index
        (room.commands[foundIndex] as any).isUndone = true;

        const userRedo = room.redoStacks.get(socket.id) || [];
        userRedo.push(room.commands[foundIndex]);
        room.redoStacks.set(socket.id, userRedo);

        // Broadcast full replay of active commands
        io.in(roomId as string).emit('undo-replay', {
          commands: room.commands.filter(c => !c.isUndone),
          baseLayerCommands: room.baseLayerCommands,
        });
        return; // Don't broadcast normal draw-event
      } else if (data.type === 'redo') {
        // USER-SCOPED REDO: pop from this user's redo stack
        const userRedo = room.redoStacks.get(socket.id) || [];
        if (userRedo.length === 0) return; // Nothing to redo

        const redoCmd = userRedo.pop()!;
        redoCmd.isUndone = false; // Restore visibility
        room.redoStacks.set(socket.id, userRedo);

        // Broadcast full replay of active commands
        io.in(roomId as string).emit('undo-replay', {
          commands: room.commands.filter(c => !c.isUndone),
          baseLayerCommands: room.baseLayerCommands,
        });
        return; // Don't broadcast normal draw-event
      } else if (data.type === 'clear') {
        room.commands = [];
        room.redoStacks.clear();
      }

      // Broadcast new strokes/fills/images to others only
      socket.to(roomId as string).emit('draw-event', data);
    });

    // ── Host Kick System ──────────────────────────────────────────────────────
    socket.on('kick-user', ({ roomId, targetId }: { roomId: unknown; targetId: string }) => {
      if (!isValidRoomId(roomId) || !socket.rooms.has(roomId)) return;
      const room = getRoom(roomId);

      // Only the host can kick
      if (room.hostId !== socket.id) return;

      // Ban for 10 minutes
      room.banned.add(targetId);
      setTimeout(() => room.banned.delete(targetId), 10 * 60 * 1000);

      // Force-disconnect the target
      const targetSocket = io.sockets.sockets.get(targetId);
      if (targetSocket) {
        targetSocket.emit('kicked', { message: 'You were removed from the room by the host.' });
        targetSocket.leave(roomId);
      }

      room.users.delete(targetId);
      room.redoStacks.delete(targetId);

      // Broadcast updated user list
      io.in(roomId).emit('room-users', {
        users: Array.from(room.users.values()),
        hostId: room.hostId,
      });
    });

    // ── Protected Layer Lock ──────────────────────────────────────────────────
    socket.on('lock-layer', ({ roomId }: { roomId: unknown }) => {
      if (!isValidRoomId(roomId) || !socket.rooms.has(roomId)) return;
      const room = getRoom(roomId);

      // Only the host can lock
      if (room.hostId !== socket.id) return;

      // Merge current active commands into the base layer
      const activeCommands = room.commands.filter(c => !c.isUndone);
      room.baseLayerCommands = [...room.baseLayerCommands, ...activeCommands];
      room.commands = [];
      room.redoStacks.clear();

      io.in(roomId).emit('layer-locked', {
        baseLayerCommands: room.baseLayerCommands,
      });
    });

    socket.on('unlock-layer', ({ roomId }: { roomId: unknown }) => {
      if (!isValidRoomId(roomId) || !socket.rooms.has(roomId)) return;
      const room = getRoom(roomId);

      if (room.hostId !== socket.id) return;

      room.commands = [...room.baseLayerCommands, ...room.commands];
      room.baseLayerCommands = [];

      io.in(roomId).emit('layer-unlocked', {
        commands: room.commands.filter(c => !c.isUndone),
      });
    });

    // Handle text events
    socket.on('text-event', ({ roomId, data }: { roomId: unknown; data: any }) => {
      if (!isValidRoomId(roomId) || !socket.rooms.has(roomId)) return;

      const room = getRoom(roomId);
      if (data.type === 'add') {
        room.texts.push(data.text);
      } else if (data.type === 'update') {
        const index = room.texts.findIndex(t => t.id === data.text.id);
        if (index !== -1) room.texts[index] = { ...room.texts[index], ...data.text };
      } else if (data.type === 'remove') {
        room.texts = room.texts.filter(t => t.id !== data.id);
      }

      socket.to(roomId).emit('text-event', data);
    });

    // Live stroke streaming — broadcast only, no storage (transient)
    // This enables real-time drawing visibility while strokes are in progress
    socket.on('stroke-live', ({ roomId, data }: { roomId: unknown; data: unknown }) => {
      if (!isValidRoomId(roomId)) return;
      if (!socket.rooms.has(roomId)) return;
      socket.to(roomId).emit('stroke-live', data);
    });

    // Live cursor streaming
    socket.on('cursor-move', ({ roomId, data }: { roomId: unknown; data: unknown }) => {
      if (!isValidRoomId(roomId) || !socket.rooms.has(roomId)) return;
      socket.to(roomId).emit('cursor-move', data);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);

      // B3 FIX: Clean up ALL rooms this socket was in
      for (const roomId of socketRooms) {
        const room = rooms[roomId];
        if (room) {
          room.users.delete(socket.id);
          room.redoStacks.delete(socket.id);
          
          // Auto-promote next host if this was the host
          if (room.hostId === socket.id) {
            const nextUser = room.users.keys().next().value;
            room.hostId = nextUser || null;
          }
          
          // Broadcast updated user list with host info
          io.in(roomId).emit('room-users', {
            users: Array.from(room.users.values()),
            hostId: room.hostId,
          });

          // If room is now empty, schedule cleanup
          if (room.users.size === 0) {
            console.log(`Room ${roomId} is now empty, scheduling cleanup in ${ROOM_TTL_MS / 1000}s`);
            scheduleRoomCleanup(roomId);
          }
        }
      }
      socketRooms.clear();
    });
  });
}
