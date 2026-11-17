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
  action: 'claim' | 'complete' | 'fail' | 'heartbeat' | 'register';
  jobId?: string;
  error?: string;
  maxAttempts?: number;
  departmentIds?: string[];
  agentName?: string;
  appVersion?: string;
}

const MAX_ATTEMPTS = 5;
const CLAIM_STALE_MINUTES = 5;

interface PrintJobRow {
  id: string;
  job_type: string;
  department_id: string | null;
  restaurant_id: string;
  printer: {
    name?: string;
    connection?: string;
    ip?: string;
    port?: number;
    paperWidthMm?: number;
  } | null;
  ticket: Record<string, unknown> | null;
  attempts: number;
  created_at: string;
}

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

    const token = authHeader.slice('Bearer '.length);
    const { data: userData } = await supabase.auth.getUser(token);
    const role = userData?.user?.role ?? (await supabase.auth.getClaims(token)).data?.claims?.role;

    let caller: { kind: 'service_role'; restaurantId: null } | { kind: 'host'; restaurantId: string } | null = null;

    if (role === 'service_role') {
      // Legacy path: trusted agent installed with the service key.
      caller = { kind: 'service_role', restaurantId: null };
    } else {
      // New path: the desktop printing app signed in with the host's account.
      // Resolve the restaurant the caller owns, so every queue operation is
      // strictly scoped to that restaurant.
      const authedClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: restaurant } = await authedClient
        .from('restaurants')
        .select('id')
        .eq('owner_id', userData?.user?.id ?? '00000000-0000-0000-0000-000000000000')
        .limit(1)
        .maybeSingle();
      if (restaurant?.id) {
        caller = { kind: 'host', restaurantId: restaurant.id };
      } else {
        return json({ error: 'Not authorized for queue operations.' }, 403);
      }
    }

    const body = (await req.json().catch(() => null)) as QueuePayload | null;
    if (!body?.action) return json({ error: 'Missing action.' }, 400);

    // ── register: create or refresh this installation's registry row ──
    if (body.action === 'register') {
      if (caller.kind !== 'host') return json({ error: 'Register is only for host sign-in installations.' }, 403);

      const { data: existing } = await supabase
        .from('print_agents')
        .select('id')
        .eq('restaurant_id', caller.restaurantId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      const now = new Date().toISOString();
      if (existing?.id) {
        const { error } = await supabase
          .from('print_agents')
          .update({
            name: body.agentName ?? 'Printing app',
            app_version: body.appVersion ?? null,
            last_heartbeat_at: now,
          })
          .eq('id', existing.id);
        if (error) return json({ error: error.message }, 500);
        return json({ agentId: existing.id });
      }

      const { data: created, error } = await supabase
        .from('print_agents')
        .insert({
          restaurant_id: caller.restaurantId,
          name: body.agentName ?? 'Printing app',
          app_version: body.appVersion ?? null,
          last_heartbeat_at: now,
        })
        .select('id')
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ agentId: created.id });
    }

    // ── heartbeat: keep this installation marked as connected ──
    if (body.action === 'heartbeat') {
      if (caller.kind !== 'host') return json({ success: true });
      const { data: agent } = await supabase
        .from('print_agents')
        .select('id')
        .eq('restaurant_id', caller.restaurantId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!agent?.id) return json({ success: true });
      const { error } = await supabase
        .from('print_agents')
        .update({ last_heartbeat_at: new Date().toISOString() })
        .eq('id', agent.id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

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
      if (caller.kind === 'host') {
        // Restaurant isolation: a signed-in app only ever sees its own restaurant.
        query = query.eq('restaurant_id', caller.restaurantId);
      }
      if (body.departmentIds && body.departmentIds.length > 0) {
        query = query.in('department_id', body.departmentIds);
      }
      const { data: pending, error } = await query;
      if (error) return json({ error: error.message }, 500);

      const jobs = (pending ?? []) as PrintJobRow[];
      if (jobs.length === 0) return json({ jobs: [] });

      const ids = jobs.map((j) => j.id);
      const { data: claimed, error: claimError } = await supabase
        .from('print_jobs')
        .update({ status: 'printing', claimed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .in('id', ids)
        .eq('status', 'pending')
        .select('id, job_type, department_id, restaurant_id, printer, ticket, attempts, created_at');
      if (claimError) return json({ error: errorText(claimError) }, 500);

      return json({ jobs: (claimed ?? []) as PrintJobRow[] });
    }

    if (!body.jobId) return json({ error: 'Missing jobId.' }, 400);

    // ── complete: printer accepted the job ──
    if (body.action === 'complete') {
      let completeQuery = supabase
        .from('print_jobs')
        .update({
          status: 'printed',
          printed_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', body.jobId);
      if (caller.kind === 'host') completeQuery = completeQuery.eq('restaurant_id', caller.restaurantId);
      const { error } = await completeQuery;
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
      let failQuery = supabase
        .from('print_jobs')
        .update({
          status: exhausted ? 'failed' : 'pending',
          attempts,
          last_error: (body.error ?? 'Unknown print error.').slice(0, 500),
          claimed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', body.jobId);
      if (caller.kind === 'host') failQuery = failQuery.eq('restaurant_id', caller.restaurantId);
      const { error } = await failQuery;
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, exhausted });
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'An unexpected error occurred.' }, 500);
  }
});

function errorText(err: { message: string }): string {
  return err.message;
}
