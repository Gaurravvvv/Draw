import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all for MVP
    methods: ["GET", "POST"]
  }
});

// In-memory store: roomId -> Array of Fabric Objects
const rooms: Record<string, any[]> = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
    
    // Send existing state to the new user
    const roomState = rooms[roomId] || [];
    socket.emit('initial-state', roomState);
  });

  // Relay drawing events & Update State
  // Client sends: { roomId, data: { type, object, objectId ... } }
  socket.on('draw-event', ({ roomId, data }) => {
    // Initialize room if not exists
    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }

    // Update Server State
    if (data.type === 'add') {
      rooms[roomId].push(data.object);
    } 
    else if (data.type === 'modify') {
      const index = rooms[roomId].findIndex(obj => obj.id === data.object.id);
      if (index !== -1) {
        rooms[roomId][index] = data.object;
      }
    } 
    else if (data.type === 'remove') {
      rooms[roomId] = rooms[roomId].filter(obj => obj.id !== data.objectId);
    }

    // Broadcast ONLY the data payload to others in the room
    socket.to(roomId).emit('draw-event', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = 3001; // Match Client URL

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
