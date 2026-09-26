import { getDatabase } from '../../../backend/db';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  const hash = new URL(request.url).searchParams.get('hash');
  if (!hash) return Response.json({ error: 'hash required' }, { status: 400 });
  const row = getDatabase().prepare('SELECT content FROM proofs WHERE hash = ?').get(hash) as any;
  return Response.json({ content: row ? row.content : null });
}
export async function POST(request: Request) {
  const { hash, content } = await request.json();
  if (!hash || !content) return Response.json({ error: 'missing fields' }, { status: 400 });
  try {
    getDatabase().prepare('INSERT OR IGNORE INTO proofs (hash, content, created_at) VALUES (?, ?, datetime(\'now\'))').run(hash, content);
    return Response.json({ success: true });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
