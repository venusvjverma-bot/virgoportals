import { supabase } from '@/lib/supabase';

const THEME_BUCKET = 'theme-assets';

export function themeAssetUrl(storagePath: string): string {
  const { data } = supabase.storage.from(THEME_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

export const MASCOT_STORAGE_PATH = 'a3249cbd-f1ac-484e-abba-7f74bd587691.png';

export function mascotUrl(): string {
  return themeAssetUrl(MASCOT_STORAGE_PATH);
}
