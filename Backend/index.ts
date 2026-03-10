import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';
import session from 'express-session';
import passport from 'passport';
import dotenv from 'dotenv';

import { configurePassport } from './config/passport';
import authRoutes from './routes/auth';
import { registerSocketHandlers } from './socket/handlers';

dotenv.config();

// --- Database ---
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/drawwww';
mongoose
  .connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

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

app.use(
  session({
    secret: process.env.COOKIE_KEY || 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      secure: false, // Set to true if using HTTPS
      httpOnly: true,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// --- Routes ---
app.use(authRoutes);

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
