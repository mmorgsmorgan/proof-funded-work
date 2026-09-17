export const runtime = 'nodejs';
export function GET() {
  return Response.json({ ok: true, service: "Q'IT", network: 'Arc testnet', chainId: 5042002 });
}
