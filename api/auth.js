import { sql } from '@vercel/postgres';
import { createHash, randomBytes } from 'crypto';

function hashPassword(password, salt) {
  return createHash('sha256').update(password + salt).digest('hex');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { action, email, password, token } = req.body;

  try {
    if (action === 'signup') {
      if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
      const salt = randomBytes(16).toString('hex');
      const hash = hashPassword(password, salt);
      const sessionToken = randomBytes(32).toString('hex');

      const { rows } = await sql`
        INSERT INTO users (email, password_hash, salt, session_token)
        VALUES (${email.toLowerCase().trim()}, ${hash}, ${salt}, ${sessionToken})
        ON CONFLICT (email) DO NOTHING
        RETURNING id, email, session_token
      `;

      if (!rows.length) {
        return res.status(409).json({ error: 'Email already exists' });
      }

      return res.status(200).json({
        user_id: rows[0].id,
        email: rows[0].email,
        token: rows[0].session_token
      });
    }

    if (action === 'login') {
      if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

      const { rows } = await sql`
        SELECT id, email, password_hash, salt FROM users
        WHERE email = ${email.toLowerCase().trim()}
      `;

      if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

      const user = rows[0];
      const hash = hashPassword(password, user.salt);

      if (hash !== user.password_hash) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const sessionToken = randomBytes(32).toString('hex');
      await sql`UPDATE users SET session_token = ${sessionToken} WHERE id = ${user.id}`;

      return res.status(200).json({
        user_id: user.id,
        email: user.email,
        token: sessionToken
      });
    }

    if (action === 'session') {
      if (!token) return res.status(400).json({ error: 'Token required' });

      const { rows } = await sql`
        SELECT id, email FROM users WHERE session_token = ${token}
      `;

      if (!rows.length) return res.status(401).json({ error: 'Invalid session' });

      return res.status(200).json({
        user_id: rows[0].id,
        email: rows[0].email
      });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    console.error('Auth API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
