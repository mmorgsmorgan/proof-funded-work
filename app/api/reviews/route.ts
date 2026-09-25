import { getDatabase } from '../../../backend/db';
import { verifyPrivyToken, getUserByPrivyId, getWalletAddress } from '../../../backend/privy';
import { uuidv7 } from '../../../backend/accounts';
import { rateLimitResponse, keyFromAuth } from '../../../backend/rate-limit';
import { logger } from '../../../backend/logger';

export const runtime = 'nodejs';

/** GET /api/reviews?submissionId=xxx - Fetch reviews */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const submissionId = url.searchParams.get('submissionId');
  
  if (!submissionId) {
    return Response.json({ error: 'submissionId is required' }, { status: 400 });
  }
  
  const db = getDatabase();
  const reviews = db.prepare('SELECT * FROM reviews WHERE submission_id = ? ORDER BY created_at DESC').all(submissionId);
  return Response.json({ reviews });
}

/** POST /api/reviews - Create a review */
export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Missing bearer token' }, { status: 401 });
  }

  // Rate limit: 10 reviews per minute per user
  const rl = rateLimitResponse(keyFromAuth(authHeader), 10, 60);
  if (rl) return rl;

  try {
    const token = authHeader.split(' ')[1];
    const claims = await verifyPrivyToken(token);
    const privyUser = await getUserByPrivyId(claims.userId);
    const walletAddress = getWalletAddress(privyUser);

    if (!walletAddress) {
      return Response.json({ error: 'User has no wallet attached' }, { status: 400 });
    }

    const { submissionId, feedback, status } = await request.json();

    if (submissionId === undefined || !feedback || !status) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = getDatabase();
    const id = uuidv7();
    
    db.prepare(`
      INSERT INTO reviews (id, submission_id, reviewer, feedback, status, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(id, submissionId, walletAddress.toLowerCase(), feedback, status);

    logger.info('review_created', { id, submissionId, reviewer: walletAddress, status });

    return Response.json({ success: true, reviewId: id });
  } catch (err) {
    const error = err as Error;
    logger.warn('review_post_failed', { error: error.message });
    return Response.json({ error: 'Failed to create review' }, { status: 500 });
  }
}
