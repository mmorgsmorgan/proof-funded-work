import { createAccount, findAccountByPrivyId } from '../../../backend/accounts';
import { AccountRole } from '../../../backend/db';
import { verifyPrivyRequest } from '../../../backend/privy';

export const runtime = 'nodejs';
const ROLES = new Set<AccountRole>(['worker', 'task_giver']);

function failure(cause: unknown) {
  const error = cause as Error & { status?: number };
  return Response.json({ error: error.message || 'Account request failed.' }, { status: error.status || 500 });
}

export async function GET(request: Request) {
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
  try {
    const body = await request.json();
    if (!ROLES.has(body.role)) return Response.json({ error: 'Role must be worker or task_giver.' }, { status: 400 });
    const identity = await verifyPrivyRequest(request);
    const account = createAccount({ ...identity, role: body.role });
    return Response.json({ account }, { status: 201 });
  } catch (cause) {
    return failure(cause);
  }
}
