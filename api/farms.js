import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { user_id } = req.method === 'GET' ? req.query : req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  try {
    if (req.method === 'GET') {
      const { rows } = await sql`
        SELECT data FROM farms
        WHERE user_id = ${user_id}
        ORDER BY updated_at DESC
        LIMIT 1
      `;
      return res.status(200).json({ farm: rows[0]?.data || null });
    }

    if (req.method === 'POST') {
      const { name, data } = req.body;
      await sql`DELETE FROM farms WHERE user_id = ${user_id}`;
      const { rows } = await sql`
        INSERT INTO farms (user_id, name, data)
        VALUES (${user_id}, ${name || 'My Farm'}, ${JSON.stringify(data)}::jsonb)
        RETURNING data
      `;
      return res.status(200).json({ farm: rows[0].data });
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM farms WHERE user_id = ${user_id}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Farm API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
