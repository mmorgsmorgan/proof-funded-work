import { syncEvents, getCachedJobs, getCachedSubmissions } from '../../../backend/indexer';

export const runtime = 'nodejs';

/**
 * GET /api/sync — Trigger an event sync and return cached on-chain data.
 *
 * Query params:
 *   ?client=0x...  — filter jobs by client address
 *   ?worker=0x...  — filter submissions by worker address
 *   ?jobId=0       — filter submissions by job ID
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const client = url.searchParams.get('client') || undefined;
    const worker = url.searchParams.get('worker') || undefined;
    const jobIdParam = url.searchParams.get('jobId');
    const jobId = jobIdParam !== null ? Number(jobIdParam) : undefined;

    // Sync latest events from chain
    const syncResult = await syncEvents();

    // Return cached data
    const jobs = getCachedJobs(client ? { client } : undefined);
    const submissions = getCachedSubmissions(
      worker ? { worker } : jobId !== undefined ? { jobId } : undefined,
    );

    return Response.json({
      sync: syncResult,
      jobs,
      submissions,
    });
  } catch (cause) {
    const error = cause as Error;
    return Response.json({ error: error.message || 'Sync failed.' }, { status: 500 });
  }
}
