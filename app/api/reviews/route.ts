import { query, queryAll } from '../../../backend/db';
import { verifyPrivyRequest } from '../../../backend/privy';
import { uuidv7 } from '../../../backend/accounts';
import { rateLimit, keyFromAuth, rateLimitResponse } from '../../../backend/rate-limit';
import { logger } from '../../../backend/logger';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const submissionId = url.searchParams.get('submissionId');
  if (!submissionId) return Response.json({ error: 'submissionId is required' }, { status: 400 });
  
  const rows = await queryAll('SELECT * FROM reviews WHERE submission_id = $1 ORDER BY created_at DESC', [submissionId]);
  return Response.json({ reviews: rows });
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

    const id = uuidv7();
    
    await query(
      'INSERT INTO reviews (id, submission_id, reviewer, feedback, status, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, submissionId, identity.walletAddress.toLowerCase(), feedback, status, new Date().toISOString()]
    );

    logger.info('review_created', { id, submissionId, reviewer: identity.walletAddress, status });
    return Response.json({ success: true, reviewId: id });
  } catch (cause) {
    const error = cause as Error & { status?: number };
    const status = error.status || 500;
    if (status >= 500) logger.error('review_post_failed', { error: error.message });
    return Response.json({ error: error.message || 'Failed to create review' }, { status });
  }
}
