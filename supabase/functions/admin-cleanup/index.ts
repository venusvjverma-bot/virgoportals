import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

/**
 * One-time, narrowly scoped storage cleanup, run only by an authenticated admin.
 *
 * Two jobs, both restricted to a hard-coded prefix so this function can never be
 * pointed at arbitrary objects:
 *
 * 1. Remove the leftover security-audit probe file from the public bucket.
 * 2. Move the legacy host menu documents out of the PUBLIC `dish-images` bucket
 *    and into the PRIVATE `menu-files` bucket. The public bucket serves any
 *    object by URL regardless of row level security, so those menu PDFs and menu
 *    photos were world readable. They are archived, not deleted, and the
 *    originals are only removed once the private copy is confirmed.
 *
 * Host menu uploads now go straight to `menu-files`, so nothing in the running
 * application reads the legacy location.
 */

const PUBLIC_BUCKET = 'dish-images';
const PRIVATE_BUCKET = 'menu-files';

/** Only objects under this prefix are ever touched. */
const LEGACY_PREFIX = 'menus';
const AUDIT_PROBE_PATH = 'menus/6fbb17b6-06d6-4b64-b753-e20c24fa86ed/__audit_probe.txt';

type Db = ReturnType<typeof createClient>;

interface MovedObject {
  path: string;
  result: 'archived' | 'already-private' | 'failed';
  detail?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function verifyUser(supabase: Db, req: Request): Promise<string | null> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

function contentTypeFor(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase() ?? '';
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'png') return 'image/png';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'webp') return 'image/webp';
  return 'application/octet-stream';
}

/** Lists every object in a bucket below the legacy prefix, one folder level deep. */
async function listLegacyPaths(supabase: Db, bucket: string): Promise<string[]> {
  const { data: entries, error } = await supabase.storage
    .from(bucket)
    .list(LEGACY_PREFIX, { limit: 1000 });
  if (error) throw error;

  const paths: string[] = [];
  for (const entry of entries ?? []) {
    const child = `${LEGACY_PREFIX}/${entry.name}`;
    // A null id means the entry is a folder, so its contents are listed too.
    if (entry.id === null) {
      const { data: nested, error: nestedError } = await supabase.storage
        .from(bucket)
        .list(child, { limit: 1000 });
      if (nestedError) throw nestedError;
      for (const file of nested ?? []) {
        if (file.id !== null) paths.push(`${child}/${file.name}`);
      }
    } else {
      paths.push(child);
    }
  }
  return paths;
}

/**
 * Legacy objects were stored as `menus/<restaurantId>/<file>`. The ownership
 * rule reads the FIRST path segment as the restaurant id, so that layout is
 * owned by nobody. Dropping the `menus/` segment puts each archived file back
 * under its restaurant's own folder, where the owning host can reach it.
 */
function normalisedPath(path: string): string {
  const stripped = path.slice(`${LEGACY_PREFIX}/`.length);
  return stripped.includes('/') ? stripped : path;
}

/** Re-keys already-archived private objects into their restaurant's folder. */
async function normalisePrivatePaths(supabase: Db): Promise<MovedObject[]> {
  const results: MovedObject[] = [];
  for (const path of await listLegacyPaths(supabase, PRIVATE_BUCKET)) {
    const target = normalisedPath(path);
    if (target === path) continue;

    try {
      const { data: blob, error: downloadError } = await supabase.storage
        .from(PRIVATE_BUCKET)
        .download(path);
      if (downloadError || !blob) {
        results.push({ path, result: 'failed', detail: 'could not read the archived copy' });
        continue;
      }

      const bytes = new Uint8Array(await blob.arrayBuffer());
      const { error: uploadError } = await supabase.storage
        .from(PRIVATE_BUCKET)
        .upload(target, bytes, { contentType: contentTypeFor(path), upsert: false });
      if (uploadError && !/already exists|Duplicate/i.test(uploadError.message)) {
        results.push({ path, result: 'failed', detail: uploadError.message });
        continue;
      }

      const folder = target.slice(0, target.lastIndexOf('/'));
      const { data: check } = await supabase.storage
        .from(PRIVATE_BUCKET)
        .list(folder, { limit: 1000 });
      if (!(check ?? []).some((entry) => entry.name === target.split('/').pop())) {
        results.push({ path, result: 'failed', detail: 're-keyed copy was not confirmed' });
        continue;
      }

      const { error: deleteError } = await supabase.storage
        .from(PRIVATE_BUCKET)
        .remove([path]);
      if (deleteError) {
        results.push({ path, result: 'failed', detail: deleteError.message });
        continue;
      }
      results.push({ path, result: 'archived', detail: target });
    } catch (error) {
      results.push({
        path,
        result: 'failed',
        detail: error instanceof Error ? error.message : 'unknown error',
      });
    }
  }
  return results;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const userId = await verifyUser(supabase, req);
    if (!userId) return json({ error: 'Please sign in to continue.' }, 401);

    const { data: admin, error: adminError } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (adminError) throw adminError;
    if (!admin) return json({ error: 'This account is not allowed to use the admin area.' }, 403);

    // 1. The leftover audit probe file. Already absent in most runs, so a
    //    no-op removal is expected and is not an error.
    const { data: removed, error: removeError } = await supabase.storage
      .from(PUBLIC_BUCKET)
      .remove([AUDIT_PROBE_PATH]);
    if (removeError) throw removeError;

    const { data: probeFolder } = await supabase.storage
      .from(PUBLIC_BUCKET)
      .list('menus/6fbb17b6-06d6-4b64-b753-e20c24fa86ed', { limit: 1000 });
    const probeStillThere = (probeFolder ?? []).some(
      (entry) => entry.name === '__audit_probe.txt'
    );

    // 2. Archive the legacy menu documents into the private bucket, then remove
    //    the public copy only after the private copy is confirmed to exist.
    const paths = (await listLegacyPaths(supabase, PUBLIC_BUCKET)).filter(
      (path) => path !== AUDIT_PROBE_PATH
    );

    const moved: MovedObject[] = [];
    for (const path of paths) {
      try {
        const { data: blob, error: downloadError } = await supabase.storage
          .from(PUBLIC_BUCKET)
          .download(path);
        if (downloadError || !blob) {
          moved.push({ path, result: 'failed', detail: 'could not read the public copy' });
          continue;
        }

        const target = normalisedPath(path);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const { error: uploadError } = await supabase.storage
          .from(PRIVATE_BUCKET)
          .upload(target, bytes, { contentType: contentTypeFor(path), upsert: false });

        // A duplicate is fine: the private copy already exists.
        if (uploadError && !/already exists|Duplicate/i.test(uploadError.message)) {
          moved.push({ path, result: 'failed', detail: uploadError.message });
          continue;
        }

        const { data: check } = await supabase.storage.from(PRIVATE_BUCKET).list(
          target.slice(0, target.lastIndexOf('/')),
          { limit: 1000 }
        );
        const archived = (check ?? []).some((entry) => entry.name === target.split('/').pop());
        if (!archived) {
          moved.push({ path, result: 'failed', detail: 'private copy was not confirmed' });
          continue;
        }

        const { error: deleteError } = await supabase.storage
          .from(PUBLIC_BUCKET)
          .remove([path]);
        if (deleteError) {
          moved.push({ path, result: 'failed', detail: deleteError.message });
          continue;
        }

        moved.push({ path, result: uploadError ? 'already-private' : 'archived', detail: target });
      } catch (error) {
        moved.push({
          path,
          result: 'failed',
          detail: error instanceof Error ? error.message : 'unknown error',
        });
      }
    }

    const remainingPublic = (await listLegacyPaths(supabase, PUBLIC_BUCKET)).filter(
      (path) => path !== AUDIT_PROBE_PATH
    );

    // Any file archived under the old `menus/` prefix is re-keyed here so the
    // owning host can reach it through the private bucket.
    const rekeyed = await normalisePrivatePaths(supabase);

    return json({
      auditProbe: { removed: removed?.length ?? 0, stillThere: probeStillThere },
      legacyDocuments: {
        considered: paths.length,
        archived: moved.filter((item) => item.result !== 'failed').length,
        failed: moved.filter((item) => item.result === 'failed'),
        stillPublic: remainingPublic,
      },
      rekeyed,
      moved,
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Cleanup failed.' },
      500
    );
  }
});
