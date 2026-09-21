export const runtime = 'nodejs';
import { getDatabase } from '../../../backend/db';

export function GET() {
  try {
    const db = getDatabase();
    db.prepare('SELECT 1').get();
    return Response.json({ ok: true, service: "Q'IT", network: 'Arc testnet', chainId: 5042002, database: 'connected' });
  } catch {
    return Response.json({ ok: false, service: "Q'IT", database: 'unavailable' }, { status: 503 });
  }
}
