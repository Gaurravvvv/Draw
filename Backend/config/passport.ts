import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../models/User';

export function configurePassport() {
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser((id, done) => {
    User.findById(id).then((user) => {
      done(null, user);
    });
  });

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!googleClientId || !googleClientSecret) {
    console.log('⚠️  Google OAuth credentials not set — Google login disabled. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env to enable.');
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: googleClientId,
        clientSecret: googleClientSecret,
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
