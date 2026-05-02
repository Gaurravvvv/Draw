import { Router } from 'express';
import passport from 'passport';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { authLimiter } from '../middleware/rateLimit';

const router = Router();
// --- Google OAuth ---
router.get(
    '/auth/google',
    passport.authenticate('google', {
        scope: ['profile', 'email'],
    })
);

router.get(
    '/auth/google/callback',
    passport.authenticate('google'),
    (req, res) => {
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
        res.redirect(clientUrl);
    }
);

// --- Manual Register ---
// Q6: Rate limited to prevent brute-force
router.post('/api/register', authLimiter, async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        res.status(400).json({ message: 'All fields are required' });
        return;
    }

    // Password validation
    if (password.length < 6) {
        res.status(400).json({ message: 'Password must be at least 6 characters' });
        return;
    }

    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        res.status(400).json({ message: 'Password must contain both letters and numbers' });
        return;
    }

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            res.status(400).json({ message: 'Email already in use' });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            username,
            email,
            password: hashedPassword,
        });
        await newUser.save();

        req.login(newUser, (err) => {
            if (err) {
                res.status(500).json({ message: 'Login error' });
                return;
            }
            // I7 FIX: toJSON transform on User model now strips password automatically
            res.json(newUser);
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// --- Manual Login ---
// Q6: Rate limited to prevent brute-force
router.post('/api/login', authLimiter, async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(400).json({ message: 'All fields are required' });
        return;
    }

    try {
        const user = await User.findOne({ email });
        if (!user) {
            res.status(400).json({ message: 'Invalid credentials' });
            return;
        }

        if (!user.password) {
            res.status(400).json({ message: 'Please login with Google' });
            return;
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            res.status(400).json({ message: 'Invalid credentials' });
            return;
        }

        req.login(user, (err) => {
            if (err) {
                res.status(500).json({ message: 'Login error' });
                return;
            }
            // I7 FIX: toJSON transform on User model now strips password automatically
            res.json(user);
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// --- Current User & Logout ---
// B2 FIX: Return null instead of undefined when not logged in (prevents JSON parse error)
router.get('/api/current_user', (req, res) => {
    res.json(req.user || null);
});

// I6 FIX: Redirect to CLIENT_URL instead of '/' (which was the backend root)
router.get('/auth/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
        res.redirect(clientUrl);
    });
});

export default router;
