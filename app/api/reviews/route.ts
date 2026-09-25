import { getDatabase } from '../../../backend/db';
import { verifyPrivyRequest } from '../../../backend/privy';
import { uuidv7 } from '../../../backend/accounts';
import { rateLimit, keyFromAuth, rateLimitResponse } from '../../../backend/rate-limit';
import { logger } from '../../../backend/logger';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const submissionId = url.searchParams.get('submissionId');
  if (!submissionId) return Response.json({ error: 'submissionId is required' }, { status: 400 });
  
  const db = getDatabase();
  const reviews = db.prepare('SELECT * FROM reviews WHERE submission_id = ? ORDER BY created_at DESC').all(submissionId);
  return Response.json({ reviews });
}

export async function POST(request: Request) {
  const rl = rateLimit(keyFromAuth(request, 'review-post'), 10, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

  try {
    const identity = await verifyPrivyRequest(request);
    const body = await request.json();
    const { submissionId, feedback, status } = body;

    if (submissionId === undefined || !feedback || !status) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = getDatabase();
    const id = uuidv7();
    
    db.prepare('INSERT INTO reviews (id, submission_id, reviewer, feedback, status, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))').run(id, submissionId, identity.walletAddress.toLowerCase(), feedback, status);

    logger.info('review_created', { id, submissionId, reviewer: identity.walletAddress, status });
    return Response.json({ success: true, reviewId: id });
  } catch (cause) {
    const error = cause as Error & { status?: number };
    const status = error.status || 500;
    if (status >= 500) logger.error('review_post_failed', { error: error.message });
    return Response.json({ error: error.message || 'Failed to create review' }, { status });
  }
}
