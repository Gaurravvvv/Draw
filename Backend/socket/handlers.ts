import { Server, Socket } from 'socket.io';
import { Room } from '../models/Room';

// --- Raster-architecture room state ---
interface RasterRoomState {
  users: Set<string>;
  /** Command log: ordered list of raster stroke commands */
  commands: RasterCommand[];
  /** Floating text objects overlay */
  texts: any[];
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

// In-memory state per room
const rooms: Record<string, RasterRoomState> = {};

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
    rooms[roomId] = { users: new Set(), commands: [], texts: [] };
  }
  return rooms[roomId];
}

/**
 * Save room state to MongoDB (debounced — waits 2s after last change)
 */
function debouncedSave(roomId: string) {
  if (saveTimers[roomId]) {
    clearTimeout(saveTimers[roomId]);
  }

  saveTimers[roomId] = setTimeout(async () => {
    try {
      const room = rooms[roomId];
      const commands = room?.commands || [];
      const texts = room?.texts || [];
      await Room.findOneAndUpdate(
        { roomId },
        { roomId, objects: commands, texts },
        { upsert: true }
      );
    } catch (err) {
      console.error(`Failed to save room ${roomId}:`, err);
    }
    delete saveTimers[roomId];
  }, 2000);
}

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

    socket.on('join-room', async (roomId: unknown) => {
      // B4 FIX: Validate roomId before processing
      if (!isValidRoomId(roomId)) {
        socket.emit('error', { message: 'Invalid room ID. Use 3-20 alphanumeric characters.' });
        return;
      }

      socket.join(roomId);
      socketRooms.add(roomId);
      console.log(`User ${socket.id} joined room ${roomId}`);

      // Track user in room
      const room = getRoom(roomId);
      room.users.add(socket.id);
      cancelRoomCleanup(roomId);

      // Load room state: cache first, then DB, then empty
      if (room.commands.length > 0 || room.texts.length > 0) {
        socket.emit('initial-state', { commands: room.commands, texts: room.texts });
      } else {
        try {
          const dbRoom = await Room.findOne({ roomId });
          if (dbRoom) {
            room.commands = Array.isArray(dbRoom.objects) ? (dbRoom.objects as unknown as RasterCommand[]) : [];
            room.texts = Array.isArray(dbRoom.texts) ? dbRoom.texts : [];
            socket.emit('initial-state', { commands: room.commands, texts: room.texts });
          } else {
            room.commands = [];
            room.texts = [];
            socket.emit('initial-state', { commands: [], texts: [] });
          }
        } catch (err) {
          console.error(`Failed to load room ${roomId}:`, err);
          room.commands = [];
          room.texts = [];
          socket.emit('initial-state', { commands: [], texts: [] });
        }
      }
    });

    // Handle raster draw events — append command to log & broadcast
    socket.on('draw-event', ({ roomId, data }: { roomId: unknown; data: { type: string; stroke?: RasterCommand } }) => {
      // B4 FIX: Validate roomId
      if (!isValidRoomId(roomId)) return;

      // B5 FIX: Verify this socket is actually in the room
      if (!socket.rooms.has(roomId)) return;

      const room = getRoom(roomId);

      if (data.type === 'stroke' && data.stroke) {
        room.commands.push(data.stroke);

        // Truncate command log if too large
        if (room.commands.length > MAX_COMMANDS) {
          room.commands = room.commands.slice(-MAX_COMMANDS);
        }
      } else if (data.type === 'clear') {
        room.commands = [];
      }

      // Broadcast to others in the room
      socket.to(roomId).emit('draw-event', data);

      // Debounced save to MongoDB
      debouncedSave(roomId);
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
      debouncedSave(roomId);
    });

    // Live stroke streaming — broadcast only, no storage (transient)
    // This enables real-time drawing visibility while strokes are in progress
    socket.on('stroke-live', ({ roomId, data }: { roomId: unknown; data: unknown }) => {
      if (!isValidRoomId(roomId)) return;
      if (!socket.rooms.has(roomId)) return;
      socket.to(roomId).emit('stroke-live', data);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);

      // B3 FIX: Clean up ALL rooms this socket was in
      for (const roomId of socketRooms) {
        const room = rooms[roomId];
        if (room) {
          room.users.delete(socket.id);

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
