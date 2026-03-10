import { Server, Socket } from 'socket.io';
import { Room } from '../models/Room';

// Track connected users per room for cleanup
const roomUsers: Record<string, Set<string>> = {};

// Debounced save timers per room
const saveTimers: Record<string, NodeJS.Timeout> = {};

// In-memory cache for fast reads (synced to DB periodically)
const roomCache: Record<string, any[]> = {};

// TTL for empty rooms (30 minutes)
const ROOM_TTL_MS = 30 * 60 * 1000;
const emptyRoomTimers: Record<string, NodeJS.Timeout> = {};

/**
 * Save room state to MongoDB (debounced — waits 2s after last change)
 */
function debouncedSave(roomId: string) {
    if (saveTimers[roomId]) {
        clearTimeout(saveTimers[roomId]);
    }

    saveTimers[roomId] = setTimeout(async () => {
        try {
            const objects = roomCache[roomId] || [];
            await Room.findOneAndUpdate(
                { roomId },
                { roomId, objects, updatedAt: new Date() },
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
        if (!roomUsers[roomId] || roomUsers[roomId].size === 0) {
            delete roomCache[roomId];
            delete roomUsers[roomId];
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

        socket.on('join-room', async (roomId: string) => {
            socket.join(roomId);
            console.log(`User ${socket.id} joined room ${roomId}`);

            // Track user in room
            if (!roomUsers[roomId]) {
                roomUsers[roomId] = new Set();
            }
            roomUsers[roomId].add(socket.id);
            cancelRoomCleanup(roomId);

            // Store which room this socket is in (for disconnect handling)
            (socket as any)._roomId = roomId;

            // Load room state: cache first, then DB, then empty
            if (roomCache[roomId]) {
                socket.emit('initial-state', roomCache[roomId]);
            } else {
                try {
                    const dbRoom = await Room.findOne({ roomId });
                    if (dbRoom) {
                        roomCache[roomId] = dbRoom.objects || [];
                        socket.emit('initial-state', roomCache[roomId]);
                    } else {
                        roomCache[roomId] = [];
                        socket.emit('initial-state', []);
                    }
                } catch (err) {
                    console.error(`Failed to load room ${roomId}:`, err);
                    roomCache[roomId] = [];
                    socket.emit('initial-state', []);
                }
            }
        });

        // Handle draw events & update state
        socket.on('draw-event', ({ roomId, data }) => {
            // Initialize room cache if not exists
            if (!roomCache[roomId]) {
                roomCache[roomId] = [];
            }

            // Update in-memory state
            if (data.type === 'add') {
                roomCache[roomId].push(data.object);
            } else if (data.type === 'modify') {
                const index = roomCache[roomId].findIndex((obj: any) => obj.id === data.object.id);
                if (index !== -1) {
                    roomCache[roomId][index] = data.object;
                }
            } else if (data.type === 'remove') {
                roomCache[roomId] = roomCache[roomId].filter((obj: any) => obj.id !== data.objectId);
            }

            // Broadcast to others in the room
            socket.to(roomId).emit('draw-event', data);

            // Debounced save to MongoDB
            debouncedSave(roomId);
        });

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);

            const roomId = (socket as any)._roomId;
            if (roomId && roomUsers[roomId]) {
                roomUsers[roomId].delete(socket.id);

                // If room is now empty, schedule cleanup
                if (roomUsers[roomId].size === 0) {
                    console.log(`Room ${roomId} is now empty, scheduling cleanup in ${ROOM_TTL_MS / 1000}s`);
                    scheduleRoomCleanup(roomId);
                }
            }
        });
    });
}
