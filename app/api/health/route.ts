export const runtime = 'nodejs';
import { query } from '../../../backend/db';

export async function GET() {
  try {
    await query('SELECT 1');
    return Response.json({ ok: true, service: "Q'IT", network: 'Arc testnet', chainId: 5042002, database: 'connected' });
  } catch (e) {
    return Response.json({ ok: false, service: "Q'IT", database: 'unavailable', error: e instanceof Error ? e.message : String(e) }, { status: 503 });
  }
}
