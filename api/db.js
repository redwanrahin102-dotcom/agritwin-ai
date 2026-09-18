import { sql } from '@vercel/postgres';

export async function query(text, params) {
  const result = await sql.query(text, params);
  return result;
}
