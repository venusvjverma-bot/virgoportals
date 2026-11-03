import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { categoriesForSection, SECTIONS, sectionLabel, categoryLabel } from '@/lib/menuSections';
import { createCombo, replaceComboGroups, updateCombo, type ComboGroupInput } from '@/lib/combos';
import { isValidPriceInput } from '@/lib/currency';
import type { Combo } from '@/types';

const MAX_REQUIRED = 20;

interface DraftGroup {
  key: string;
  section: string;
  category: string;
  requiredCount: string;
}

interface ComboBuilderProps {
  restaurantId: string;
  departmentId?: string | null;
  eventId?: string | null;
  combo: Combo | null;
  sortOrder: number;
  onClose: () => void;
  onSaved: () => void;
}

function draftKey(): string {
  return Math.random().toString(36).slice(2);
}

function defaultGroup(): DraftGroup {
  const section = SECTIONS[0];
  return { key: draftKey(), section: section.value, category: section.categories[0].value, requiredCount: '1' };
}

function initialGroups(combo: Combo | null): DraftGroup[] {
  if (!combo || combo.groups.length === 0) return [defaultGroup()];
  return [...combo.groups]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((g) => ({ key: draftKey(), section: g.section, category: g.category, requiredCount: String(g.requiredCount) }));
}

function parseRequired(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return parsed <= MAX_REQUIRED ? parsed : null;
}

export function ComboBuilder({ restaurantId, departmentId, eventId, combo, sortOrder, onClose, onSaved }: ComboBuilderProps) {
  const [name, setName] = useState(combo?.name ?? '');
  const [description, setDescription] = useState(combo?.description ?? '');
  const [price, setPrice] = useState(combo?.price ?? '');
  const [isActive, setIsActive] = useState(combo?.isActive ?? true);
  const [groups, setGroups] = useState<DraftGroup[]>(() => initialGroups(combo));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateGroup(key: string, patch: Partial<DraftGroup>) {
    setGroups((prev) => prev.map((g) => (g.key === key ? { ...g, ...patch } : g)));
  }

  function moveGroup(index: number, direction: -1 | 1) {
    setGroups((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function validate(): { groups: ComboGroupInput[] } | string {
    if (!name.trim()) return 'Give the combo a name.';
    if (!price.trim() || !isValidPriceInput(price.trim())) return 'Enter a valid price, for example 189.';
    if (groups.length === 0) return 'Add at least one step to the combo.';
    const parsed: ComboGroupInput[] = [];
    for (const group of groups) {
      const requiredCount = parseRequired(group.requiredCount);
      if (requiredCount === null) return `Each step needs a whole number of choices between 0 and ${MAX_REQUIRED}.`;
      parsed.push({ section: group.section, category: group.category, requiredCount });
    }
    if (!parsed.some((g) => g.requiredCount > 0)) return 'At least one step must ask the visitor to choose a dish.';
    return { groups: parsed };
  }

  async function handleSave() {
    const result = validate();
    if (typeof result === 'string') {
      setError(result);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input = { name: name.trim(), description: description.trim(), price: price.trim(), isActive };
      let comboId: string;
      if (combo) {
        await updateCombo(combo.id, input);
        comboId = combo.id;
      } else {
        const created = await createCombo(
          restaurantId,
          { ...input, departmentId: departmentId ?? null, eventId: eventId ?? null },
          sortOrder,
        );
        comboId = created.id;
      }
      await replaceComboGroups(comboId, result.groups);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The combo could not be saved. Please try again.');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Combo builder">
      <button type="button" aria-label="Close combo builder" className="absolute inset-0 cursor-default bg-ink/45 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-cream-50 shadow-lift sm:max-w-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-cream-200 px-5 py-4 sm:px-6">
          <h2 className="font-display text-xl text-ink">{combo ? 'Edit combo' : 'New combo'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors duration-200 hover:bg-cream-100 hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="combo-name">
              <Input id="combo-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Lunch combo" maxLength={80} />
            </Field>
            <Field label="Price" htmlFor="combo-price" hint="The combo's base price">
              <Input id="combo-price" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="189" inputMode="decimal" />
            </Field>
          </div>

          <Field label="Description" htmlFor="combo-description">
            <textarea
              id="combo-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="What the guest gets with this combo"
              className="w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-olive-400 focus:outline-none focus:ring-2 focus:ring-olive-100"
            />
          </Field>

          <label className="flex items-center gap-3 text-sm text-ink">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-olive-600" />
            Show this combo to visitors
          </label>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-ink">Steps</h3>
                <p className="text-xs text-ink-muted">Each step picks dishes from one category. Visitors choose the number you set.</p>
              </div>
            </div>

            <ol className="space-y-3">
              {groups.map((group, index) => {
                const categories = categoriesForSection(group.section);
                return (
                  <li key={group.key} className="rounded-2xl bg-white p-4 ring-1 ring-cream-200">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-olive-700">Step {index + 1}</span>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => moveGroup(index, -1)} disabled={index === 0} aria-label={`Move step ${index + 1} up`} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-cream-100 disabled:opacity-30">
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => moveGroup(index, 1)} disabled={index === groups.length - 1} aria-label={`Move step ${index + 1} down`} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-cream-100 disabled:opacity-30">
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => setGroups((prev) => prev.filter((g) => g.key !== group.key))} aria-label={`Remove step ${index + 1}`} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-red-50 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label="Section" htmlFor={`group-section-${group.key}`}>
                        <Select
                          id={`group-section-${group.key}`}
                          value={group.section}
                          onChange={(e) => {
                            const nextSection = e.target.value;
                            updateGroup(group.key, { section: nextSection, category: categoriesForSection(nextSection)[0].value });
                          }}
                        >
                          {SECTIONS.map((s) => (
                            <option key={s.value} value={s.value}>{sectionLabel(s.value)}</option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Category" htmlFor={`group-category-${group.key}`}>
                        <Select id={`group-category-${group.key}`} value={group.category} onChange={(e) => updateGroup(group.key, { category: e.target.value })}>
                          {categories.map((c) => (
                            <option key={c.value} value={c.value}>{categoryLabel(c.value)}</option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Choices" htmlFor={`group-count-${group.key}`} hint="0 = not chosen">
                        <Input id={`group-count-${group.key}`} inputMode="numeric" value={group.requiredCount} onChange={(e) => updateGroup(group.key, { requiredCount: e.target.value })} />
                      </Field>
                    </div>
                  </li>
                );
              })}
            </ol>

            <Button variant="secondary" size="sm" className="mt-3" onClick={() => setGroups((prev) => [...prev, defaultGroup()])}>
              <Plus className="h-4 w-4" />
              Add step
            </Button>
          </div>

          {error ? <Notice tone="error">{error}</Notice> : null}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-cream-200 bg-white px-5 py-4 sm:px-6">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving…' : 'Save combo'}
          </Button>
        </div>
      </div>
    </div>
  );
}
