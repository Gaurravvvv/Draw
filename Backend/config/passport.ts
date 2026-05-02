import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../models/User';

export function configurePassport() {
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // B1 FIX: Added .catch() to prevent hanging requests when DB is down
  passport.deserializeUser((id, done) => {
    User.findById(id)
      .then((user) => {
        done(null, user);
      })
      .catch((err) => {
        done(err, null);
      });
  });

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!googleClientId || !googleClientSecret) {
    console.log('⚠️  Google OAuth credentials not set — Google login disabled. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env to enable.');
    return;
  }

  // Q10 FIX: Build full callback URL from env to work behind reverse proxies
  const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;

  passport.use(
    new GoogleStrategy(
      {
        clientID: googleClientId,
        clientSecret: googleClientSecret,
        callbackURL: `${backendUrl}/auth/google/callback`,
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
            email: email || `no-email-${profile.id}@example.com`,
            profilePicture: profile.photos?.[0]?.value,
          }).save();
          done(null, newUser);
        } catch (err) {
          done(err, undefined);
        }
      }
    )
  );
}
