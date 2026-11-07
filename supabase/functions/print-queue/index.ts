import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface QueuePayload {
  action: 'claim' | 'complete' | 'fail';
  jobId?: string;
  error?: string;
  maxAttempts?: number;
  departmentIds?: string[];
}

const MAX_ATTEMPTS = 5;
const CLAIM_STALE_MINUTES = 5;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return json({ error: 'Missing authorization.' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Only the service role (print agent or trusted callers) may drive the queue.
    const token = authHeader.slice('Bearer '.length);
    const { data: userData } = await supabase.auth.getUser(token);
    const role = userData?.user?.role ?? (await supabase.auth.getClaims(token)).data?.claims?.role;
    if (role !== 'service_role') {
      return json({ error: 'Not authorized for queue operations.' }, 403);
    }

    const body = (await req.json().catch(() => null)) as QueuePayload | null;
    if (!body?.action) return json({ error: 'Missing action.' }, 400);

    // ── claim: fetch pending jobs and mark them as printing ──
    if (body.action === 'claim') {
      // First, requeue jobs stuck in 'printing' whose agent died mid-delivery.
      const staleCutoff = new Date(Date.now() - CLAIM_STALE_MINUTES * 60_000).toISOString();
      await supabase
        .from('print_jobs')
        .update({ status: 'pending', claimed_at: null })
        .eq('status', 'printing')
        .lt('claimed_at', staleCutoff);

      let query = supabase
        .from('print_jobs')
        .select('id, job_type, department_id, restaurant_id, printer, ticket, attempts, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(20);
      if (body.departmentIds && body.departmentIds.length > 0) {
        query = query.in('department_id', body.departmentIds);
      }
      const { data: pending, error } = await query;
      if (error) return json({ error: error.message }, 500);

      const jobs = pending ?? [];
      if (jobs.length === 0) return json({ jobs: [] });

      const ids = jobs.map((j) => j.id);
      const { data: claimed, error: claimError } = await supabase
        .from('print_jobs')
        .update({ status: 'printing', claimed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .in('id', ids)
        .eq('status', 'pending')
        .select('id, job_type, department_id, restaurant_id, printer, ticket, attempts, created_at');
      if (claimError) return json({ error: claimError.message }, 500);

      return json({ jobs: claimed ?? [] });
    }

    if (!body.jobId) return json({ error: 'Missing jobId.' }, 400);

    // ── complete: printer accepted the job ──
    if (body.action === 'complete') {
      const { error } = await supabase
        .from('print_jobs')
        .update({
          status: 'printed',
          printed_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', body.jobId);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    // ── fail: record the error and retry later unless attempts are exhausted ──
    if (body.action === 'fail') {
      const { data: job } = await supabase
        .from('print_jobs')
        .select('attempts')
        .eq('id', body.jobId)
        .maybeSingle();
      if (!job) return json({ error: 'Job not found.' }, 404);

      const attempts = job.attempts + 1;
      const exhausted = attempts >= (body.maxAttempts ?? MAX_ATTEMPTS);
      const { error } = await supabase
        .from('print_jobs')
        .update({
          status: exhausted ? 'failed' : 'pending',
          attempts,
          last_error: (body.error ?? 'Unknown print error.').slice(0, 500),
          claimed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', body.jobId);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, exhausted });
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'An unexpected error occurred.' }, 500);
  }
});
