import { Router } from 'express';
import passport from 'passport';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';

const router = Router();
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

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
        res.redirect(CLIENT_URL);
    }
);

// --- Manual Register ---
router.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        res.status(400).send({ message: 'All fields are required' });
        return;
    }

    // Password validation
    if (password.length < 6) {
        res.status(400).send({ message: 'Password must be at least 6 characters' });
        return;
    }

    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        res.status(400).send({ message: 'Password must contain both letters and numbers' });
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
            password: hashedPassword,
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

// --- Manual Login ---
router.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(400).send({ message: 'All fields are required' });
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

// --- Current User & Logout ---
router.get('/api/current_user', (req, res) => {
    res.send(req.user);
});

router.get('/auth/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        res.redirect('/');
    });
});

export default router;
