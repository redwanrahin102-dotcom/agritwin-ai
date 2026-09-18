import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'POST') {
      const { user_id, kind, message, payload } = req.body;
      if (!user_id) return res.status(400).json({ error: 'user_id required' });

      await sql`
        INSERT INTO activity (user_id, kind, message, payload)
        VALUES (${user_id}, ${kind || 'EVENT'}, ${message || ''}, ${payload ? JSON.stringify(payload) : null}::jsonb)
      `;
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'GET') {
      const { user_id, limit } = req.query;
      if (!user_id) return res.status(400).json({ error: 'user_id required' });

      const { rows } = await sql`
        SELECT * FROM activity
        WHERE user_id = ${user_id}
        ORDER BY created_at DESC
        LIMIT ${parseInt(limit) || 20}
      `;
      return res.status(200).json({ activities: rows });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Activity API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
