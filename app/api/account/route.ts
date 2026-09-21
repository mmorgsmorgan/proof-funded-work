import { createAccount, findAccountByPrivyId } from '../../../backend/accounts';
import { AccountRole } from '../../../backend/db';
import { checkIdempotency, saveIdempotency, cleanExpiredKeys } from '../../../backend/idempotency';
import { verifyPrivyRequest } from '../../../backend/privy';
import { rateLimit, keyFromAuth, rateLimitResponse } from '../../../backend/rate-limit';

export const runtime = 'nodejs';
const ROLES = new Set<AccountRole>(['worker', 'task_giver']);

function failure(cause: unknown) {
  const error = cause as Error & { status?: number };
  return Response.json({ error: error.message || 'Account request failed.' }, { status: error.status || 500 });
}

export async function GET(request: Request) {
  // Rate limit: 30 req/min per auth token
  const rl = rateLimit(keyFromAuth(request, 'account-get'), 30, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

  try {
    const identity = await verifyPrivyRequest(request);
    const account = findAccountByPrivyId(identity.privyUserId);
    if (!account) return Response.json({ error: 'Account onboarding is not complete.' }, { status: 404 });
    return Response.json({ account });
  } catch (cause) {
    return failure(cause);
  }
}

export async function POST(request: Request) {
  // Rate limit: 5 req/min per auth token
  const rl = rateLimit(keyFromAuth(request, 'account-post'), 5, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

  // Idempotency: check for duplicate requests
  const idempotencyKey = request.headers.get('idempotency-key');
  if (idempotencyKey) {
    const cached = checkIdempotency(idempotencyKey);
    if (cached) {
      return new Response(cached.body, {
        status: cached.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    const body = await request.json();
    if (!ROLES.has(body.role)) return Response.json({ error: 'Role must be worker or task_giver.' }, { status: 400 });
    const identity = await verifyPrivyRequest(request);
    const account = createAccount({ ...identity, role: body.role });
    const responseBody = JSON.stringify({ account });
    const status = 201;

    // Save idempotency key for successful responses
    if (idempotencyKey) {
      saveIdempotency(idempotencyKey, status, responseBody);
    }

    // Periodically clean expired keys (roughly every 100th request)
    if (Math.random() < 0.01) cleanExpiredKeys();

    return new Response(responseBody, {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (cause) {
    return failure(cause);
  }
}
