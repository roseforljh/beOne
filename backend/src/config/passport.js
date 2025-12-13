import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
// import { Strategy as QQStrategy } from 'passport-qq'; // 暂时禁用：该包不支持ES模块
import { db } from './database.js';
import jwt from 'jsonwebtoken';

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const findOrCreateUser = (profile, provider, done) => {
  const email = profile.emails?.[0]?.value;
  const oauth_id = profile.id;
  
  if (!email) {
    return done(new Error('Email not provided by OAuth provider'));
  }

  db.get(
    'SELECT * FROM users WHERE email = ? OR (oauth_provider = ? AND oauth_id = ?)',
    [email, provider, oauth_id],
    (err, user) => {
      if (err) return done(err);

      if (user) {
        if (!user.oauth_provider) {
          db.run(
            'UPDATE users SET oauth_provider = ?, oauth_id = ? WHERE id = ?',
            [provider, oauth_id, user.id],
            (updateErr) => {
              if (updateErr) return done(updateErr);
              const token = generateToken(user.id);
              return done(null, { ...user, token });
            }
          );
        } else {
          const token = generateToken(user.id);
          return done(null, { ...user, token });
        }
      } else {
        const username = `${provider}_${oauth_id}`;
        const password = Math.random().toString(36).slice(-16);
        
        db.run(
          'INSERT INTO users (username, password, email, oauth_provider, oauth_id) VALUES (?, ?, ?, ?, ?)',
          [username, password, email, provider, oauth_id],
          function(insertErr) {
            if (insertErr) return done(insertErr);
            
            db.get('SELECT * FROM users WHERE id = ?', [this.lastID], (getErr, newUser) => {
              if (getErr) return done(getErr);
              const token = generateToken(newUser.id);
              return done(null, { ...newUser, token });
            });
          }
        );
      }
    }
  );
};

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/api/auth/google/callback',
    proxy: true
  }, (accessToken, refreshToken, profile, done) => {
    findOrCreateUser(profile, 'google', done);
  }));
}

// QQ OAuth 暂时禁用（passport-qq不支持ES模块）
// if (process.env.QQ_APP_ID && process.env.QQ_APP_KEY) {
//   passport.use(new QQStrategy({
//     clientID: process.env.QQ_APP_ID,
//     clientSecret: process.env.QQ_APP_KEY,
//     callbackURL: '/api/auth/qq/callback',
//     proxy: true
//   }, (accessToken, refreshToken, profile, done) => {
//     findOrCreateUser(profile, 'qq', done);
//   }));
// }

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  db.get('SELECT * FROM users WHERE id = ?', [id], (err, user) => {
    done(err, user);
  });
});

export default passport;