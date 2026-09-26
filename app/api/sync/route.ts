import { syncEvents, getCachedJobs, getCachedSubmissions } from '../../../backend/indexer';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const client = url.searchParams.get('client') || undefined;
    const worker = url.searchParams.get('worker') || undefined;
    const jobIdParam = url.searchParams.get('jobId');
    const jobId = jobIdParam !== null ? Number(jobIdParam) : undefined;

    const syncResult = await syncEvents();

    const jobs = await getCachedJobs(client ? { client } : undefined);
    const submissions = await getCachedSubmissions(
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
