import { supabase } from '@/lib/supabase';
import { callFunction } from '@/lib/functions';
import type { AdminModels, CreditAdjustment, CreditHost, Host, ModelConfig, ModelState, UsageRow } from '@/types';

export type ModelKind = 'chat' | 'image';

export async function adminWhoami(): Promise<boolean> {
  const result = await callFunction<{ isAdmin: boolean }>('admin-api', { action: 'whoami' });
  return result.isAdmin === true;
}

export async function adminReadModels(): Promise<AdminModels> {
  return callFunction('admin-api', { action: 'read' });
}

export async function adminSaveModel(kind: ModelKind, config: ModelConfig): Promise<ModelState> {
  const result = await callFunction<{ model: ModelState }>('admin-api', {
    action: 'save',
    kind,
    provider: config.provider,
    model: config.model,
    endpoint: config.endpoint,
    apiKey: config.apiKey,
    reasoningEnabled: config.reasoningEnabled,
    temperature: config.temperature,
    maxOutputTokens: config.maxOutputTokens,
  });
  return result.model;
}

export async function adminTestModel(
  kind: ModelKind
): Promise<{ reply?: string; imageUrl?: string; notice?: string }> {
  return callFunction('admin-api', { action: 'test', kind });
}

export async function adminListHosts(): Promise<Host[]> {
  const result = await callFunction<{ hosts: Host[] }>('admin-api', { action: 'hosts' });
  return result.hosts ?? [];
}

export async function adminListUsage(): Promise<UsageRow[]> {
  const result = await callFunction<{ usage: UsageRow[] }>('admin-api', { action: 'usage' });
  return result.usage ?? [];
}

export async function adminGetBotText(): Promise<string> {
  const result = await callFunction<{ text: string }>('admin-api', { action: 'getBotText' });
  return result.text ?? '';
}

export async function adminSaveBotText(text: string): Promise<void> {
  await callFunction('admin-api', { action: 'saveBotText', text });
}

export async function adminSetHostStatus(restaurantId: string, status: string): Promise<void> {
  await callFunction('admin-api', { action: 'setHostStatus', restaurantId, status });
}

export async function adminCreateHost(input: {
  email: string;
  password: string;
  restaurantName: string;
  city: string;
}): Promise<{ restaurantId: string }> {
  return callFunction('admin-api', { action: 'createHost', ...input });
}

export interface ThemeAsset {
  id: string;
  filename: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  shared: boolean;
  createdAt: string;
}

export async function adminListThemeAssets(): Promise<ThemeAsset[]> {
  const result = await callFunction<{ assets: ThemeAsset[] }>('admin-api', { action: 'listThemeAssets' });
  return result.assets ?? [];
}

export async function adminUploadThemeAsset(file: File): Promise<ThemeAsset> {
  const formData = new FormData();
  formData.append('action', 'uploadThemeAsset');
  formData.append('file', file);

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-api`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  const body = await response.json().catch(() => null);
  if (!response.ok || !body) {
    throw new Error(body?.error ?? `Upload failed (${response.status}).`);
  }
  return body.asset as ThemeAsset;
}

export async function adminDeleteThemeAsset(assetId: string): Promise<void> {
  await callFunction('admin-api', { action: 'deleteThemeAsset', assetId });
}

export async function adminListCredits(): Promise<CreditHost[]> {
  const result = await callFunction<{ hosts: CreditHost[] }>('admin-api', { action: 'listCredits' });
  return result.hosts ?? [];
}

export async function adminAdjustCredit(
  restaurantId: string,
  operation: 'add' | 'remove',
  amount: number
): Promise<{ previousBalance: number; resultingBalance: number }> {
  return callFunction('admin-api', { action: 'adjustCredit', restaurantId, operation, amount });
}

export async function adminListCreditAdjustments(restaurantId: string): Promise<CreditAdjustment[]> {
  const result = await callFunction<{ adjustments: CreditAdjustment[] }>('admin-api', {
    action: 'listCreditAdjustments',
    restaurantId,
  });
  return result.adjustments ?? [];
}

export async function adminSetThemeAssetShared(assetId: string, shared: boolean): Promise<ThemeAsset> {
  const result = await callFunction<{ asset: ThemeAsset }>('admin-api', {
    action: 'setThemeAssetShared',
    assetId,
    shared,
  });
  return result.asset;
}

/** Public (shared) theme images a host may pick from — admin-approved only. */
export async function listSharedThemeAssets(): Promise<ThemeAsset[]> {
  const { data, error } = await supabase
    .from('theme_assets')
    .select('id, filename, storage_path, content_type, size_bytes, shared, created_at')
    .eq('shared', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    filename: row.filename as string,
    storagePath: row.storage_path as string,
    contentType: row.content_type as string,
    sizeBytes: row.size_bytes as number,
    shared: row.shared === true,
    createdAt: row.created_at as string,
  }));
}
