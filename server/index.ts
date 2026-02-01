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

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  // Relay drawing events
  // Client sends: { roomId, data: { type, object, ... } }
  socket.on('draw-event', ({ roomId, data }) => {
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
