import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables FIRST before importing local modules that depend on them
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
import { registerSocketHandlers, rooms } from './socket/handlers';
import { registerGameSocketHandlers } from './socket/gameHandlers';
import { registerScribbleSocketHandlers } from './socket/scribbleHandlers';
import gameRoutes from './routes/gameRoutes';



// --- Express App ---
const app = express();
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' })); // Increased for PNG base64 payloads

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // CSP handled separately for SPA compatibility
  crossOriginEmbedderPolicy: false, // Required for cross-origin image loading
}));

// Rate limiting for AI scoring endpoint (prevents API billing abuse)
const scoreLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 10, // 10 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many score requests. Please slow down.' },
});
app.use(
  cors({
    origin: CLIENT_URL,
    methods: 'GET,POST,PUT,DELETE',
    credentials: true,
  })
);

// Game mode API routes
app.use('/api/game/score', scoreLimiter); // Rate limit the scoring endpoint
app.use('/api/game', gameRoutes);

// Silence Chrome DevTools .well-known probe (harmless, but noisy in console)
app.get('/.well-known/{*path}', (_req, res) => res.status(204).end());

// F14: Health check endpoint for Docker/K8s readiness probes
// F14: Health check endpoint for Docker/K8s readiness probes
// Note: uptime removed to avoid information disclosure
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
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
  // Cap max WebSocket message size to prevent memory exhaustion attacks
  maxHttpBufferSize: 5 * 1024 * 1024, // 5MB
});

registerSocketHandlers(io);
registerGameSocketHandlers(io);
registerScribbleSocketHandlers(io);

// --- Start ---
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
