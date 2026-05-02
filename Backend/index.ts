import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import passport from 'passport';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables FIRST before importing local modules that depend on them
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

import { configurePassport } from './config/passport';
import authRoutes from './routes/auth';
import { registerSocketHandlers } from './socket/handlers';

// --- Database ---
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/drawwww';

mongoose
  .connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => {
    console.error('❌ MongoDB connection error. Please ensure MongoDB is running locally or via Docker:', err.message);
    process.exit(1);
  });

// --- Passport ---
configurePassport();

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

// I5 FIX: Use MongoStore instead of MemoryStore to prevent memory leaks
// and persist sessions across server restarts
app.use(
  session({
    secret: process.env.COOKIE_KEY || 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: MONGO_URI,
      ttl: 24 * 60 * 60, // 1 day (matches cookie maxAge)
      autoRemove: 'native',
    }),
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      secure: process.env.NODE_ENV === 'production', // Auto-detect based on environment
      httpOnly: true,
      sameSite: 'lax',
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Silence Chrome DevTools .well-known probe (harmless, but noisy in console)
app.get('/.well-known/{*path}', (_req, res) => res.status(204).end());

// --- Routes ---
app.use(authRoutes);

// F14: Health check endpoint for Docker/K8s readiness probes
app.get('/health', (_req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const isHealthy = mongoStatus === 'connected';
  
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    mongo: mongoStatus,
    uptime: Math.floor(process.uptime()),
  });
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
