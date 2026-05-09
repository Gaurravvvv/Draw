import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables FIRST before importing local modules that depend on them
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
import { registerSocketHandlers, rooms } from './socket/handlers';



// --- Express App ---
const app = express();
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(
  cors({
    origin: CLIENT_URL,
    methods: 'GET,POST,PUT,DELETE',
    credentials: true,
  })
);

// Silence Chrome DevTools .well-known probe (harmless, but noisy in console)
app.get('/.well-known/{*path}', (_req, res) => res.status(204).end());

// F14: Health check endpoint for Docker/K8s readiness probes
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
  });
});

app.get('/api/room/:id', (req, res) => {
  const roomId = req.params.id.toUpperCase();
  const exists = !!rooms[roomId];
  res.json({ exists });
});

// --- Socket.io ---
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

registerSocketHandlers(io);

// --- Start ---
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
