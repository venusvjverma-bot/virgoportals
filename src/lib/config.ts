import { supabase } from '@/lib/supabase';
import { DEFAULT_BOT_TEXT } from '@/lib/constants';

/**
 * The admin's default bot text. Hosts may read this one row to seed their own
 * prompt; row level security exposes only the `botText` key to non-admins.
 */
export async function getBotText(): Promise<string> {
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'botText')
    .maybeSingle();
  if (error) throw error;
  const value = data?.value as { text?: string } | undefined;
  return value?.text ?? DEFAULT_BOT_TEXT;
}
