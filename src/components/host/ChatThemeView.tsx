import { useEffect, useState } from 'react';
import { Check, ImageOff, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { cn } from '@/lib/cn';
import { listSharedThemeAssets, type ThemeAsset } from '@/lib/adminApi';
import { themeAssetUrl } from '@/lib/themeAssets';
import { updateDepartment } from '@/lib/departments';
import { updateEvent } from '@/lib/events';
import type { Department, EventItem } from '@/types';

interface ChatThemeViewProps {
  resource: Department | EventItem;
  resourceType: 'department' | 'event';
  onSaved: () => void;
}

export function ChatThemeView({ resource, resourceType, onSaved }: ChatThemeViewProps) {
  const [assets, setAssets] = useState<ThemeAsset[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = await listSharedThemeAssets();
        if (active) setAssets(rows);
      } catch (err) {
        if (active) setLoadError(err instanceof Error ? err.message : 'Could not load shared images.');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const assignedId = resource.chatBackgroundAssetId;

  async function handleSelect(assetId: string | null) {
    if (savingId) return;
    setSavingId(assetId ?? '__none__');
    setSaveError(null);
    try {
      if (resourceType === 'department') {
        await updateDepartment(resource.id, { chatBackgroundAssetId: assetId });
      } else {
        await updateEvent(resource.id, { chatBackgroundAssetId: assetId });
      }
      await onSaved();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save the background.');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <Card className="animate-fade-in">
        <h3 className="font-display text-lg font-semibold tracking-tight text-ink">Chat background</h3>
        <p className="mt-1 text-sm text-ink-muted">
          Choose one of the images your admin has shared to show as the background on this{' '}
          {resourceType === 'department' ? 'department' : 'event'}'s visitor chat page. Pick "No image" to use the
          plain background.
        </p>

        {loadError ? (
          <Notice tone="error" className="mt-4">
            {loadError}
          </Notice>
        ) : null}
        {saveError ? (
          <Notice tone="error" className="mt-4">
            {saveError}
          </Notice>
        ) : null}

        {assets === null && !loadError ? (
          <div className="mt-5 flex items-center gap-2 text-sm text-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading shared images…
          </div>
        ) : null}

        {assets !== null ? (
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {/* No image option */}
            <div className="flex flex-col gap-2">
              <div
                className={cn(
                  'flex aspect-square flex-col items-center justify-center gap-2 rounded-xl ring-1',
                  assignedId === null
                    ? 'bg-olive-50 ring-2 ring-olive-600'
                    : 'bg-cream-100 ring-cream-200'
                )}
              >
                {savingId === '__none__' ? (
                  <Loader2 className="h-6 w-6 animate-spin text-olive-600" />
                ) : (
                  <ImageOff className={cn('h-6 w-6', assignedId === null ? 'text-olive-700' : 'text-ink-faint')} />
                )}
                <span className={cn('text-xs font-medium', assignedId === null ? 'text-olive-700' : 'text-ink-muted')}>
                  No image
                </span>
              </div>
              {assignedId === null ? (
                <span className="flex items-center justify-center gap-1.5 rounded-lg bg-olive-50 px-3 py-2 text-xs font-semibold text-olive-700 ring-1 ring-olive-200">
                  <Check className="h-3.5 w-3.5" />
                  Current theme
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleSelect(null)}
                  disabled={savingId !== null}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-medium text-ink-soft ring-1 ring-cream-200 transition-all duration-200 hover:bg-cream-50 hover:ring-olive-300 disabled:cursor-wait disabled:opacity-50"
                >
                  {savingId === '__none__' ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Clearing…
                    </>
                  ) : (
                    <>
                      <ImageOff className="h-3.5 w-3.5" />
                      Remove background
                    </>
                  )}
                </button>
              )}
            </div>

            {assets.map((asset) => {
              const isSelected = assignedId === asset.id;
              return (
                <div key={asset.id} className="flex flex-col gap-2">
                  <div
                    className={cn(
                      'relative aspect-square overflow-hidden rounded-xl ring-1',
                      isSelected ? 'ring-2 ring-olive-600' : 'ring-cream-200'
                    )}
                  >
                    <img
                      src={themeAssetUrl(asset.storagePath)}
                      alt={asset.filename}
                      className="h-full w-full object-cover"
                    />
                    {isSelected ? (
                      <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-olive-700 text-white shadow-soft">
                        {savingId === asset.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                      </span>
                    ) : savingId === asset.id ? (
                      <span className="absolute inset-0 flex items-center justify-center bg-ink/40">
                        <Loader2 className="h-6 w-6 animate-spin text-white" />
                      </span>
                    ) : null}
                  </div>
                  {isSelected ? (
                    <span className="flex items-center justify-center gap-1.5 rounded-lg bg-olive-50 px-3 py-2 text-xs font-semibold text-olive-700 ring-1 ring-olive-200">
                      <Check className="h-3.5 w-3.5" />
                      Current theme
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleSelect(asset.id)}
                      disabled={savingId !== null}
                      aria-label={`Use ${asset.filename} as chat background`}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-medium text-ink-soft ring-1 ring-cream-200 transition-all duration-200 hover:bg-cream-50 hover:ring-olive-300 disabled:cursor-wait disabled:opacity-50"
                    >
                      {savingId === asset.id ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Applying…
                        </>
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Select as theme
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        {assets !== null && assets.length === 0 ? (
          <p className="mt-5 text-sm text-ink-muted">
            Your admin has not shared any images yet. Check back later.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
