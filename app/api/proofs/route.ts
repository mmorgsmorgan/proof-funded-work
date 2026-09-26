import { query, queryOne } from '../../../backend/db';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const hash = new URL(request.url).searchParams.get('hash');
  if (!hash) return Response.json({ error: 'hash required' }, { status: 400 });
  const row = await queryOne<{ content: string }>('SELECT content FROM proofs WHERE hash = $1', [hash]);
  return Response.json({ content: row ? row.content : null });
}

export async function POST(request: Request) {
  const { hash, content } = await request.json();
  if (!hash || !content) return Response.json({ error: 'missing fields' }, { status: 400 });
  try {
    await query(
      `INSERT INTO proofs (hash, content, created_at) VALUES ($1, $2, $3)
       ON CONFLICT (hash) DO NOTHING`,
      [hash, content, new Date().toISOString()]
    );
    return Response.json({ success: true });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
