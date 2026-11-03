import { useCallback, useEffect, useState } from 'react';
import { Layers, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Notice } from '@/components/ui/Notice';
import { ComboBuilder } from '@/components/host/ComboBuilder';
import { deleteCombo, listCombos } from '@/lib/combos';
import { categoryLabel, sectionLabel } from '@/lib/menuSections';
import { formatPriceInput, normalizeCurrency } from '@/lib/currency';
import type { Combo } from '@/types';

interface ComboManagerProps {
  restaurantId: string;
  departmentId?: string | null;
  eventId?: string | null;
  currency?: string | null;
}

type Editor = { mode: 'new' } | { mode: 'edit'; combo: Combo } | null;

function inScope(combo: Combo, departmentId: string | null, eventId: string | null): boolean {
  return combo.departmentId === departmentId && combo.eventId === eventId;
}

function groupSummary(combo: Combo): string {
  if (combo.groups.length === 0) return 'No steps yet';
  return combo.groups
    .map((g) => `${categoryLabel(g.category)} (${sectionLabel(g.section)}) x${g.requiredCount}`)
    .join(' · ');
}

export function ComboManager({ restaurantId, departmentId, eventId, currency }: ComboManagerProps) {
  const scopeDepartment = departmentId ?? null;
  const scopeEvent = eventId ?? null;
  const [combos, setCombos] = useState<Combo[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor>(null);
  const [pendingDelete, setPendingDelete] = useState<Combo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const all = await listCombos(restaurantId);
      setCombos(all.filter((c) => inScope(c, scopeDepartment, scopeEvent)));
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load combos.');
    }
  }, [restaurantId, scopeDepartment, scopeEvent]);

  useEffect(() => {
    setCombos(null);
    void reload();
  }, [reload]);

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setActionError(null);
    try {
      await deleteCombo(pendingDelete.id);
      setPendingDelete(null);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'The combo could not be deleted.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Combos</h2>
          <p className="text-sm text-ink-muted">Set menus that visitors build from your dishes.</p>
        </div>
        <Button onClick={() => setEditor({ mode: 'new' })}>
          <Plus className="h-4 w-4" />
          New combo
        </Button>
      </div>

      {loadError ? <Notice tone="error">{loadError}</Notice> : null}
      {actionError ? <Notice tone="error">{actionError}</Notice> : null}

      {combos === null && !loadError ? (
        <Card className="flex items-center justify-center gap-2 py-14 text-sm text-ink-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading combos…
        </Card>
      ) : combos && combos.length === 0 ? (
        <Card className="flex flex-col items-center py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cream-100 text-olive-600">
            <Layers className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm font-medium text-ink">No combos yet</p>
          <p className="mt-1 max-w-sm text-sm text-ink-muted">Create a combo to offer a set menu, such as a main course with a drink and a dessert.</p>
        </Card>
      ) : combos ? (
        <ul className="space-y-3">
          {combos.map((combo) => (
            <li key={combo.id} className="flex flex-wrap items-center gap-4 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-cream-200 transition-shadow duration-200 hover:shadow-lift">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-ink">{combo.name}</p>
                  <span className={combo.isActive ? 'rounded-full bg-olive-100 px-2 py-0.5 text-xs font-medium text-olive-800' : 'rounded-full bg-cream-200 px-2 py-0.5 text-xs font-medium text-ink-muted'}>
                    {combo.isActive ? 'Visible' : 'Hidden'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-muted">{groupSummary(combo)}</p>
              </div>
              <p className="shrink-0 text-sm font-semibold text-ink">{formatPriceInput(combo.price, normalizeCurrency(currency))}</p>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setEditor({ mode: 'edit', combo })}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPendingDelete(combo)} aria-label={`Delete ${combo.name}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {editor ? (
        <ComboBuilder
          restaurantId={restaurantId}
          departmentId={scopeDepartment}
          eventId={scopeEvent}
          combo={editor.mode === 'edit' ? editor.combo : null}
          sortOrder={combos?.length ?? 0}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            void reload();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this combo?"
        confirmLabel="Delete combo"
        tone="danger"
        busy={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setPendingDelete(null)}
      >
        {pendingDelete ? <p>{pendingDelete.name} will be removed from the menu. Orders already placed keep their record of what was chosen.</p> : null}
      </ConfirmDialog>
    </div>
  );
}
