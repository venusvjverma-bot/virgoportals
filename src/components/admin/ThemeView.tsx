import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, CircleDashed, ImageIcon, Loader2, Plus, Trash2, Upload, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { cn } from '@/lib/cn';
import {
  adminListThemeAssets,
  adminUploadThemeAsset,
  adminDeleteThemeAsset,
  adminSetThemeAssetShared,
  type ThemeAsset,
} from '@/lib/adminApi';
import { supabase } from '@/lib/supabase';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/apng'];
const ACCEPTED_EXT = '.jpg,.jpeg,.png,.apng';

function assetUrl(storagePath: string): string {
  const { data } = supabase.storage.from('theme-assets').getPublicUrl(storagePath);
  return data.publicUrl;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ThemeView() {
  const [assets, setAssets] = useState<ThemeAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<ThemeAsset | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await adminListThemeAssets();
      setAssets(loaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load theme assets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const valid = files.filter((file) => ACCEPTED_TYPES.includes(file.type));
    if (valid.length < files.length) {
      setSaveError(`${files.length - valid.length} file(s) skipped — unsupported type. Use .jpg, .jpeg, .png, or .apng.`);
    } else {
      setSaveError(null);
    }
    setSelectedFiles((prev) => [...prev, ...valid]);
    const newPreviews = valid.map((file) => URL.createObjectURL(file));
    setPreviews((prev) => [...prev, ...newPreviews]);
    setSaveSuccess(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removePreview(index: number) {
    URL.revokeObjectURL(previews[index]);
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (selectedFiles.length === 0 || saving) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    let uploaded = 0;
    let failed = 0;
    try {
      for (const file of selectedFiles) {
        try {
          await adminUploadThemeAsset(file);
          uploaded++;
        } catch {
          failed++;
        }
      }
      previews.forEach((url) => URL.revokeObjectURL(url));
      setSelectedFiles([]);
      setPreviews([]);
      await load();
      if (failed > 0) {
        setSaveError(`${failed} file(s) failed to upload.`);
      }
      setSaveSuccess(uploaded > 0 ? `${uploaded} image(s) saved successfully.` : null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(asset: ThemeAsset) {
    setDeletingId(asset.id);
    try {
      await adminDeleteThemeAsset(asset.id);
      setAssets((prev) => prev.filter((item) => item.id !== asset.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete that asset.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleShared(asset: ThemeAsset) {
    if (togglingId) return;
    setTogglingId(asset.id);
    const nextShared = !asset.shared;
    try {
      const updated = await adminSetThemeAssetShared(asset.id, nextShared);
      setAssets((prev) => prev.map((item) => (item.id === asset.id ? updated : item)));
      if (previewAsset?.id === asset.id) setPreviewAsset(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update sharing.');
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <Card padded={false} className="animate-fade-in overflow-hidden">
        <div className="border-b border-cream-200 px-6 py-5">
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Upload images</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Select .jpg, .jpeg, .png, or .apng images to add to the theme library.
          </p>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXT}
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="theme-file-input"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
            >
              <Plus className="h-4 w-4" />
              Select images
            </Button>
            {selectedFiles.length > 0 ? (
              <span className="text-sm text-ink-muted">
                {selectedFiles.length} image{selectedFiles.length > 1 ? 's' : ''} selected
              </span>
            ) : null}
          </div>

          {saveError ? <Notice tone="error">{saveError}</Notice> : null}
          {saveSuccess ? <Notice tone="success">{saveSuccess}</Notice> : null}

          {previews.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {previews.map((url, index) => (
                <div
                  key={index}
                  className="group relative overflow-hidden rounded-xl bg-cream-100 ring-1 ring-cream-200"
                >
                  <img src={url} alt={selectedFiles[index]?.name} className="aspect-square w-full object-cover" />
                  <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                    <span className="truncate text-xs text-ink-muted">{selectedFiles[index]?.name}</span>
                    <button
                      type="button"
                      onClick={() => removePreview(index)}
                      aria-label="Remove image"
                      className="shrink-0 rounded-md p-1 text-ink-faint transition-colors hover:bg-cream-200 hover:text-error-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {previews.length > 0 ? (
            <div className="flex items-center gap-3">
              <Button onClick={handleSave} disabled={saving || selectedFiles.length === 0}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Save {selectedFiles.length} image{selectedFiles.length > 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          ) : null}
        </div>
      </Card>

      <Card padded={false} className="animate-fade-in overflow-hidden">
        <div className="border-b border-cream-200 px-6 py-5">
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Saved images</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            {assets.length > 0 ? `${assets.length} image${assets.length > 1 ? 's' : ''} in the library · click a badge to share or unshare with hosts` : 'No images saved yet.'}
          </p>
        </div>

        <div className="px-6 py-5">
          {error ? <Notice tone="error" className="mb-4">{error}</Notice> : null}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading images…
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cream-100 text-ink-faint">
                <ImageIcon className="h-6 w-6" />
              </span>
              <p className="mt-4 text-sm text-ink-muted">No images in the library yet. Upload some above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  className={cn(
                    'group relative overflow-hidden rounded-xl bg-cream-100 ring-1 transition-all duration-200 hover:shadow-lift',
                    asset.shared ? 'ring-olive-300' : 'opacity-55 ring-cream-200'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setPreviewAsset(asset)}
                    className="block w-full"
                    aria-label={`View ${asset.filename}`}
                  >
                    <img
                      src={assetUrl(asset.storagePath)}
                      alt={asset.filename}
                      className={cn('aspect-square w-full object-cover', !asset.shared && 'grayscale')}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleToggleShared(asset)}
                    disabled={togglingId === asset.id}
                    aria-label={
                      asset.shared
                        ? `Stop sharing ${asset.filename} with hosts`
                        : `Share ${asset.filename} with hosts`
                    }
                    aria-pressed={asset.shared}
                    className={cn(
                      'absolute left-2 top-2 flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold shadow-soft ring-1 transition-all duration-200',
                      'disabled:cursor-wait disabled:opacity-70',
                      asset.shared
                        ? 'bg-olive-700 text-white ring-olive-700 hover:bg-olive-800'
                        : 'bg-white/95 text-ink-muted ring-cream-300 hover:bg-cream-50'
                    )}
                  >
                    {togglingId === asset.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : asset.shared ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <CircleDashed className="h-3 w-3" />
                    )}
                    {asset.shared ? 'Shared' : 'Unshared'}
                  </button>
                  <div className="px-2.5 py-2">
                    <p className="truncate text-xs font-medium text-ink">{asset.filename}</p>
                    <p className="mt-0.5 text-[11px] text-ink-faint">{formatBytes(asset.sizeBytes)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDelete(asset)}
                    disabled={deletingId === asset.id}
                    aria-label={`Delete ${asset.filename}`}
                    className={cn(
                      'absolute right-2 top-2 rounded-lg bg-white/90 p-1.5 text-error-600 shadow-soft ring-1 ring-cream-200',
                      'opacity-0 transition-all duration-200 group-hover:opacity-100',
                      'hover:bg-white hover:ring-error-200 disabled:opacity-50'
                    )}
                  >
                    {deletingId === asset.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {previewAsset ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 px-5 py-8 backdrop-blur-sm animate-fade-in"
          onClick={() => setPreviewAsset(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
        >
          <div
            className="relative max-h-full max-w-3xl overflow-auto rounded-2xl bg-white p-4 shadow-lift"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewAsset(null)}
              aria-label="Close preview"
              className="absolute right-3 top-3 z-10 rounded-lg bg-white/90 p-2 text-ink-soft shadow-soft ring-1 ring-cream-200 transition-colors hover:bg-cream-50 hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={assetUrl(previewAsset.storagePath)}
              alt={previewAsset.filename}
              className="max-h-[70vh] w-auto rounded-lg"
            />
            <div className="mt-3 flex items-center justify-between gap-4">
              <p className="truncate text-sm font-medium text-ink">{previewAsset.filename}</p>
              <span className="shrink-0 text-xs text-ink-muted">{formatBytes(previewAsset.sizeBytes)}</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
