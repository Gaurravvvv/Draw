import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { User } from './models/User';

dotenv.config();

// --- DB & MODEL SETUP ---
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/drawwww')
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// --- PASSPORT CONFIG ---
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id).then((user) => {
    done(null, user);
  });
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: '/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // 1. Check if user exists with this Google ID
        let existingUser = await User.findOne({ googleId: profile.id });
        if (existingUser) {
          return done(null, existingUser);
        }

        // 2. Check if user exists with this email (if provided)
        const email = profile.emails?.[0]?.value;
        if (email) {
            existingUser = await User.findOne({ email });
            if (existingUser) {
                // Link Google ID to existing email account
                existingUser.googleId = profile.id;
                await existingUser.save();
                return done(null, existingUser);
            }
        }

        // 3. Create new user
        const newUser = await new User({
          googleId: profile.id,
          username: profile.displayName,
          email: email || `no-email-${profile.id}@example.com`, // Fallback if no email
          profilePicture: profile.photos?.[0]?.value
        }).save();
        done(null, newUser);
      } catch (err) {
        done(err, undefined);
      }
    }
  )
);

const app = express();

// --- MIDDLEWARE ---
app.use(express.json()); // Parse JSON bodies
app.use(cors({
  origin: "http://localhost:5173", // Allow Frontend
  methods: "GET,POST,PUT,DELETE",
  credentials: true, // Allow cookies
}));

app.use(session({
  secret: process.env.COOKIE_KEY || "your_secret_key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    secure: false // Set to true if using HTTPS
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// --- AUTH ROUTES ---

// 1. Google OAuth
app.get(
  '/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
);

app.get(
  '/auth/google/callback',
  passport.authenticate('google'),
  (req, res) => {
    res.redirect('http://localhost:5173');
  }
);

// 2. Manual Register
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    res.status(400).send({ message: 'Missing fields' });
    return;
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).send({ message: 'Email already in use' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username,
      email,
      password: hashedPassword
    });
    await newUser.save();

    req.login(newUser, (err) => {
      if (err) {
        res.status(500).send({ message: 'Login error' });
        return;
      }
      res.send(newUser);
    });

  } catch (err) {
    res.status(500).send({ message: 'Server error' });
  }
});

// 3. Manual Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).send({ message: 'Missing fields' });
    return;
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      res.status(400).send({ message: 'Invalid credentials' });
      return;
    }

    if (!user.password) {
      res.status(400).send({ message: 'Please login with Google' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(400).send({ message: 'Invalid credentials' });
      return;
    }

    req.login(user, (err) => {
      if (err) {
        res.status(500).send({ message: 'Login error' });
        return;
      }
      res.send(user);
    });

  } catch (err) {
    res.status(500).send({ message: 'Server error' });
  }
});

// 4. Current User & Logout
app.get('/api/current_user', (req, res) => {
  res.send(req.user);
});

app.get('/auth/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect('/');
  });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Allow Frontend
    methods: ["GET", "POST"],
    credentials: true
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

const PORT = 3000; // Match Client URL

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
