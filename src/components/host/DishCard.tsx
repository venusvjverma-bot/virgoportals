import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { cn } from '@/lib/cn';
import { formatPriceInput, normalizeCurrency, parsePriceToMinor } from '@/lib/currency';
import type { Dish, DishServingOption, ServingUnit } from '@/types';

const SERVING_UNITS: ServingUnit[] = ['cl', 'ml', 'oz'];

export type ServingOptionInput = { id?: string; label: string; price: string; quantity?: number | null; unit?: ServingUnit | null; sortOrder: number };

type ServingOptionDraft = { id?: string; quantity: string; unit: ServingUnit; price: string; name: string; mode: ServingMode };

type ServingMode = 'measured' | 'named';

function servingModeFor(options: DishServingOption[]): ServingMode {
  return options.some((o) => o.unit !== null) ? 'measured' : 'named';
}

function draftFromOption(o: { id?: string; label: string; price: string; quantity?: number | null; unit?: string | null }): ServingOptionDraft {
  if (o.quantity !== null && o.quantity !== undefined && (o.unit === 'cl' || o.unit === 'ml' || o.unit === 'oz')) {
    return { id: o.id, quantity: String(o.quantity), unit: o.unit, price: o.price, name: '', mode: 'measured' };
  }
  return { id: o.id, quantity: '', unit: 'cl', price: o.price, name: o.label, mode: 'named' };
}

function composeServingLabel(quantity: string, unit: ServingUnit): string {
  return `${quantity.trim()} ${unit}`;
}

function composeNamedLabel(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}
export type RemovableIngredientInput = { id?: string; label: string; sortOrder: number };
export type VariantInput = { id?: string; name: string; additionalPrice: string; sortOrder: number };
type VariantDraft = { id?: string; name: string; additionalPrice: string };
import {
  SECTIONS,
  categoriesForSection,
  categoryBelongsToSection,
  categoryLabel,
  isDrinkSection,
  sectionLabel,
} from '@/lib/menuSections';

type DishPatch = Pick<
  Dish,
  'name' | 'description' | 'ingredients' | 'allergy' | 'price' | 'category' | 'section' | 'serving' | 'abv' | 'available'
>;

interface DishCardProps {
  dish: Dish | null;
  index: number;
  isNew?: boolean;
  currency?: string;
  onSave: (patch: DishPatch, servingOptions?: ServingOptionInput[], removableIngredients?: RemovableIngredientInput[], variants?: VariantInput[]) => Promise<string | void>;
  onGenerateImage: () => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancelNew?: () => void;
}

type SaveState = 'idle' | 'saving' | 'saved';

function emptyLabel(value: string, fallback: string): string {
  return value.trim() ? value : fallback;
}

const EMPTY_DRAFT: DishPatch = {
  name: '',
  description: '',
  ingredients: '',
  allergy: '',
  price: '',
  category: 'main_courses',
  section: 'food',
  serving: '',
  abv: '',
  available: true,
};

export function DishCard({
  dish,
  index,
  isNew = false,
  currency,
  onSave,
  onGenerateImage,
  onDelete,
  onCancelNew,
}: DishCardProps) {
  const cur = normalizeCurrency(currency);
  const [editing, setEditing] = useState(isNew);
  const [name, setName] = useState(dish?.name ?? '');
  const [description, setDescription] = useState(dish?.description ?? '');
  const [ingredients, setIngredients] = useState(dish?.ingredients ?? '');
  const [allergy, setAllergy] = useState(dish?.allergy ?? '');
  const [price, setPrice] = useState(dish?.price ?? '');
  const [section, setSection] = useState(dish?.section ?? 'food');
  const [category, setCategory] = useState(dish?.category ?? 'main_courses');
  const [serving, setServing] = useState(dish?.serving ?? '');
  const [abv, setAbv] = useState(dish?.abv ?? '');
  const [available, setAvailable] = useState(dish?.available ?? true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [servingOpts, setServingOpts] = useState<ServingOptionDraft[]>([]);
  const [servingMode, setServingMode] = useState<ServingMode>('measured');
  const [removableIngs, setRemovableIngs] = useState<{ id?: string; label: string }[]>([]);
  const [variantDrafts, setVariantDrafts] = useState<VariantDraft[]>([]);
  const [newIngredient, setNewIngredient] = useState('');

  const dishId = dish?.id;

  useEffect(() => {
    if (!dish) return;
    setName(dish.name);
    setDescription(dish.description);
    setIngredients(dish.ingredients);
    setAllergy(dish.allergy);
    setPrice(dish.price);
    setSection(dish.section);
    setCategory(dish.category);
    setServing(dish.serving);
    setAbv(dish.abv);
    setAvailable(dish.available);
    setServingOpts(dish.servingOptions?.map(draftFromOption) ?? []);
    setServingMode(servingModeFor(dish.servingOptions ?? []));
    setRemovableIngs(dish.removableIngredients?.map((i) => ({ id: i.id, label: i.label })) ?? []);
    setVariantDrafts(dish.variants.map((v) => ({ id: v.id, name: v.name, additionalPrice: v.additionalPrice })));
    setNewIngredient('');
    setSaveState('idle');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dishId]);

  const savedServingOpts = dish?.servingOptions?.map(draftFromOption) ?? [];
  const savedServingMode = dish ? servingModeFor(dish.servingOptions ?? []) : 'measured';
  const savedRemovableIngs = dish?.removableIngredients?.map((i) => ({ id: i.id, label: i.label })) ?? [];
  const savedVariants = dish?.variants.map((v) => ({ id: v.id, name: v.name, additionalPrice: v.additionalPrice })) ?? [];

  const savedValues = dish
    ? {
        name: dish.name,
        description: dish.description,
        ingredients: dish.ingredients,
        allergy: dish.allergy,
        price: dish.price,
        section: dish.section,
        category: dish.category,
        serving: dish.serving,
        abv: dish.abv,
        available: dish.available,
      }
    : EMPTY_DRAFT;

  const servingOptsDirty = servingMode !== savedServingMode ||
    servingOpts.length !== savedServingOpts.length ||
    servingOpts.some((o, i) =>
      o.quantity !== (savedServingOpts[i]?.quantity ?? '') ||
      o.unit !== (savedServingOpts[i]?.unit ?? 'cl') ||
      o.price !== (savedServingOpts[i]?.price ?? '') ||
      (o.id ?? undefined) !== (savedServingOpts[i]?.id ?? undefined)
    );

  const removableIngsDirty = removableIngs.length !== savedRemovableIngs.length ||
    removableIngs.some((o, i) =>
      o.label !== (savedRemovableIngs[i]?.label ?? '') ||
      (o.id ?? undefined) !== (savedRemovableIngs[i]?.id ?? undefined)
    );

  const variantsDirty = variantDrafts.length !== savedVariants.length ||
    variantDrafts.some((v, i) =>
      v.name !== (savedVariants[i]?.name ?? '') ||
      v.additionalPrice !== (savedVariants[i]?.additionalPrice ?? '') ||
      (v.id ?? undefined) !== (savedVariants[i]?.id ?? undefined)
    );

  const dirty =
    name !== savedValues.name ||
    description !== savedValues.description ||
    ingredients !== savedValues.ingredients ||
    allergy !== savedValues.allergy ||
    price !== savedValues.price ||
    section !== savedValues.section ||
    category !== savedValues.category ||
    serving !== savedValues.serving ||
    abv !== savedValues.abv ||
    available !== savedValues.available ||
    servingOptsDirty ||
    removableIngsDirty ||
    variantsDirty;

  const showAbv = isDrinkSection(section) || abv.trim().length > 0;
  const showSavedAbv = dish
    ? isDrinkSection(dish.section) || dish.abv.trim().length > 0
    : false;
  const hasServingOptionsConfigured = servingOpts.some((o) => o.quantity.trim() || o.name.trim());
  const hideHeadlinePrice = section !== 'add_on' && hasServingOptionsConfigured;

  const currentCategoryOptions = categoriesForSection(section);

  function handleSectionChange(newSection: string) {
    setSection(newSection);
    if (!categoryBelongsToSection(category, newSection)) {
      setCategory(categoriesForSection(newSection)[0].value);
    }
    setSaveState('idle');
  }

  function resetToSaved() {
    setName(savedValues.name);
    setDescription(savedValues.description);
    setIngredients(savedValues.ingredients);
    setAllergy(savedValues.allergy);
    setPrice(savedValues.price);
    setSection(savedValues.section);
    setCategory(savedValues.category);
    setServing(savedValues.serving);
    setAbv(savedValues.abv);
    setAvailable(savedValues.available);
    setServingOpts(savedServingOpts.map((o) => ({ ...o })));
    setServingMode(savedServingMode);
    setRemovableIngs(savedRemovableIngs.map((i) => ({ id: i.id, label: i.label })));
    setVariantDrafts(savedVariants.map((v) => ({ ...v })));
    setNewIngredient('');
    setSaveState('idle');
    setError(null);
  }

  function startEditing() {
    resetToSaved();
    setEditing(true);
  }

  function cancelEditing() {
    resetToSaved();
    setEditing(false);
  }

  function moveVariant(idx: number, direction: -1 | 1) {
    setVariantDrafts((prev) => {
      const target = idx + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    setSaveState('idle');
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError('A dish needs a name before it can be saved.');
      return;
    }

    // Serving sizes are required for a drink only once the host starts filling
    // them in; a drink without serving rows is saved with its base price.
    const filled = servingMode === 'measured'
      ? servingOpts.filter((o) => o.quantity.trim() || o.price.trim())
      : servingOpts.filter((o) => o.name.trim() || o.price.trim());
    if (isDrinkSection(section) && hasServingOptionsConfigured && filled.length === 0) {
      setError('Add at least one serving size with a price for this drink.');
      return;
    }
    if (section !== 'add_on') {
      if (servingMode === 'measured') {
        for (const opt of filled) {
          const qty = Number(opt.quantity.replace(',', '.'));
          if (!opt.quantity.trim() || !Number.isFinite(qty) || qty <= 0) {
            setError('Every serving size needs a positive quantity (e.g. 25 or 0.5).');
            return;
          }
          if (!SERVING_UNITS.includes(opt.unit)) {
            setError('Choose a measurement unit (cl, ml or oz) for every serving size.');
            return;
          }
          if (!opt.price.trim()) {
            setError(`Enter a price for the serving size "${composeServingLabel(opt.quantity, opt.unit)}".`);
            return;
          }
        }
      } else {
        for (const opt of filled) {
          if (!opt.name.trim()) {
            setError('Every serving size needs a name (e.g. "Small", "Large").');
            return;
          }
          if (!opt.price.trim()) {
            setError(`Enter a price for the serving size "${opt.name.trim()}".`);
            return;
          }
        }
      }
    }

    const cleanedOptions = section !== 'add_on'
      ? servingMode === 'measured'
        ? servingOpts
            .filter((o) => o.quantity.trim() && o.price.trim())
            .map((o, i) => ({
              id: o.id,
              label: composeServingLabel(o.quantity, o.unit),
              price: o.price.trim(),
              quantity: Number(o.quantity.replace(',', '.')),
              unit: o.unit,
              sortOrder: i,
            }))
        : servingOpts
            .filter((o) => o.name.trim() && o.price.trim())
            .map((o, i) => ({
              id: o.id,
              label: composeNamedLabel(o.name),
              price: o.price.trim(),
              quantity: null,
              unit: null,
              sortOrder: i,
            }))
      : undefined;

    const cleanedIngredients = removableIngs
      .filter((o) => o.label.trim())
      .map((o, i) => ({ id: o.id, label: o.label.trim(), sortOrder: i }));
    const ingredientInput = cleanedIngredients.length > 0 ? cleanedIngredients : undefined;

    const cleanedVariants = variantDrafts.map((v, i) => ({
      id: v.id,
      name: v.name.trim(),
      additionalPrice: v.additionalPrice.trim(),
      sortOrder: i,
    }));
    const seenVariantNames = new Set<string>();
    for (const variant of cleanedVariants) {
      if (!variant.name) {
        setError('Every variant needs a name.');
        return;
      }
      if (seenVariantNames.has(variant.name.toLowerCase())) {
        setError(`The variant "${variant.name}" is listed more than once.`);
        return;
      }
      seenVariantNames.add(variant.name.toLowerCase());
      const extraMinor = parsePriceToMinor(variant.additionalPrice);
      if (extraMinor === null || extraMinor < 0) {
        setError(`Enter an extra price for "${variant.name}" (use 0 if it costs the same).`);
        return;
      }
    }

    setSaveState('saving');
    try {
      await onSave(
        { name, description, ingredients, allergy, price, category, section, serving, abv, available },
        cleanedOptions,
        ingredientInput,
        cleanedVariants
      );
      setSaveState('saved');
      setEditing(false);
      if (isNew && onCancelNew) onCancelNew();
    } catch (err) {
      setSaveState('idle');
      setError(err instanceof Error ? err.message : 'Could not save this dish.');
    }
  }

  async function handleGenerate() {
    setImageError(null);
    setGenerating(true);
    try {
      await onGenerateImage();
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Image generation failed.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete() {
    setError(null);
    setDeleting(true);
    try {
      await onDelete?.();
      setConfirmDelete(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this dish.');
    } finally {
      setDeleting(false);
    }
  }

  const fieldIdPrefix = isNew ? 'new-dish' : `dish-${dish?.id}`;

  return (
    <article
      className="animate-fade-in rounded-2xl bg-white p-5 shadow-soft ring-1 ring-cream-200/80 sm:p-6"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="sm:w-44 sm:shrink-0">
          {dish?.imageUrl ? (
            <img
              src={dish.imageUrl}
              alt={dish.name || 'Dish'}
              className="h-40 w-full rounded-xl bg-cream-50 object-contain ring-1 ring-cream-200 sm:h-44"
            />
          ) : (
            <div className="flex h-40 w-full items-center justify-center rounded-xl bg-cream-100 text-xs text-ink-faint ring-1 ring-inset ring-cream-200 sm:h-44">
              No image yet
            </div>
          )}
          {!isNew ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3 w-full"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <ImagePlus className="h-4 w-4" />
                    Generate image
                  </>
                )}
              </Button>
              {imageError ? (
                <p className="mt-2 text-xs leading-relaxed text-error-600">{imageError}</p>
              ) : null}
            </>
          ) : (
            <p className="mt-3 text-xs leading-relaxed text-ink-muted">
              Save the dish first, then generate an image from the dish list.
            </p>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {editing ? (
            <>
              {isNew ? (
                <h3 className="mb-4 font-display text-lg font-semibold tracking-tight text-ink">
                  New dish
                </h3>
              ) : null}
              <div className={cn('grid gap-4', isDrinkSection(section) ? 'sm:grid-cols-1' : 'sm:grid-cols-2')}>
                <Field label="Dish name" htmlFor={`${fieldIdPrefix}-name`}>
                  <Input
                    id={`${fieldIdPrefix}-name`}
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      setSaveState('idle');
                    }}
                  />
                </Field>
                {hideHeadlinePrice ? null : (
                  <Field label={`Price (${cur})`} htmlFor={`${fieldIdPrefix}-price`}>
                    <Input
                      id={`${fieldIdPrefix}-price`}
                      value={price}
                      placeholder="0"
                      inputMode="decimal"
                      onChange={(event) => {
                        setPrice(event.target.value);
                        setSaveState('idle');
                      }}
                    />
                  </Field>
                )}
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Section" htmlFor={`${fieldIdPrefix}-section`}>
                  <Select
                    id={`${fieldIdPrefix}-section`}
                    value={section}
                    onChange={(event) => handleSectionChange(event.target.value)}
                  >
                    {SECTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Category" htmlFor={`${fieldIdPrefix}-category`}>
                  <Select
                    id={`${fieldIdPrefix}-category`}
                    value={category}
                    onChange={(event) => {
                      setCategory(event.target.value);
                      setSaveState('idle');
                    }}
                  >
                    {currentCategoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              {(isDrinkSection(section) || hasServingOptionsConfigured) ? (
                showAbv ? (
                  <div className="mt-4 grid gap-4 sm:grid-cols-1">
                    <Field label="Alcohol %" htmlFor={`${fieldIdPrefix}-abv`}>
                      <Input
                        id={`${fieldIdPrefix}-abv`}
                        value={abv}
                        placeholder="e.g. 4.5%"
                        inputMode="decimal"
                        onChange={(event) => {
                          setAbv(event.target.value.replace(/[^\d.,]/g, ''));
                          setSaveState('idle');
                        }}
                      />
                    </Field>
                  </div>
                ) : null
              ) : (
                <div
                  className={cn(
                    'mt-4 grid gap-4',
                    showAbv ? 'sm:grid-cols-2' : 'sm:grid-cols-1'
                  )}
                >
                  <Field label="Serving size" htmlFor={`${fieldIdPrefix}-serving`}>
                    <Input
                      id={`${fieldIdPrefix}-serving`}
                      value={serving}
                      placeholder="e.g. 40 cl, 1 plate"
                      onChange={(event) => {
                        setServing(event.target.value);
                        setSaveState('idle');
                      }}
                    />
                  </Field>
                  {showAbv ? (
                    <Field label="Alcohol %" htmlFor={`${fieldIdPrefix}-abv`}>
                      <Input
                        id={`${fieldIdPrefix}-abv`}
                        value={abv}
                        placeholder="e.g. 4.5%"
                        inputMode="decimal"
                        onChange={(event) => {
                          setAbv(event.target.value.replace(/[^\d.,]/g, ''));
                          setSaveState('idle');
                        }}
                      />
                    </Field>
                  ) : null}
                </div>
              )}

              {section !== 'add_on' ? (
                <div className="mt-4 rounded-xl bg-cream-50 p-4 ring-1 ring-cream-200">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Serving sizes</p>
                    <div className="flex rounded-lg bg-cream-100 p-0.5 ring-1 ring-cream-200">
                      {([['measured', 'Measured'], ['named', 'Named size']] as const).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setServingMode(value);
                            setSaveState('idle');
                          }}
                          className={cn(
                            'rounded-md px-3 py-1 text-xs font-semibold transition',
                            servingMode === value
                              ? 'bg-white text-ink shadow-soft'
                              : 'text-ink-muted hover:text-ink'
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {servingMode === 'measured' ? (
                    <>
                  <div className="mt-3 grid grid-cols-[1fr_5rem_1fr_2.5rem] gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">Quantity</span>
                    <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">Unit</span>
                    <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">Price</span>
                    <span />
                  </div>
                  <div className="mt-2 space-y-2">
                    {servingOpts.map((opt, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_5rem_1fr_2.5rem] gap-2">
                        <Input
                          value={opt.quantity}
                          placeholder="e.g. 25"
                          inputMode="decimal"
                          aria-label="Serving quantity"
                          onChange={(e) => {
                            const digits = e.target.value.replace(/[^\d.,]/g, '');
                            setServingOpts((prev) => prev.map((o, i) => i === idx ? { ...o, quantity: digits } : o));
                            setSaveState('idle');
                          }}
                        />
                        <Select
                          value={opt.unit}
                          aria-label="Serving unit"
                          onChange={(e) => {
                            setServingOpts((prev) => prev.map((o, i) => i === idx ? { ...o, unit: e.target.value as ServingUnit } : o));
                            setSaveState('idle');
                          }}
                        >
                          {SERVING_UNITS.map((u) => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </Select>
                        <Input
                          value={opt.price}
                          placeholder="0"
                          inputMode="decimal"
                          onChange={(e) => {
                            setServingOpts((prev) => prev.map((o, i) => i === idx ? { ...o, price: e.target.value } : o));
                            setSaveState('idle');
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setServingOpts((prev) => prev.filter((_, i) => i !== idx));
                            setSaveState('idle');
                          }}
                          className="flex h-[42px] w-10 items-center justify-center rounded-lg text-error-500 ring-1 ring-cream-200 transition hover:bg-error-50"
                          aria-label="Remove serving size"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                    </>
                  ) : (
                    <>
                  <div className="mt-3 grid grid-cols-[1fr_1fr_2.5rem] gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">Serving name</span>
                    <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">Price</span>
                    <span />
                  </div>
                  <div className="mt-2 space-y-2">
                    {servingOpts.map((opt, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_1fr_2.5rem] gap-2">
                        <Input
                          value={opt.name}
                          placeholder="e.g. Small, Family Size"
                          aria-label="Serving name"
                          onChange={(e) => {
                            setServingOpts((prev) => prev.map((o, i) => i === idx ? { ...o, name: e.target.value } : o));
                            setSaveState('idle');
                          }}
                        />
                        <Input
                          value={opt.price}
                          placeholder="0"
                          inputMode="decimal"
                          onChange={(e) => {
                            setServingOpts((prev) => prev.map((o, i) => i === idx ? { ...o, price: e.target.value } : o));
                            setSaveState('idle');
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setServingOpts((prev) => prev.filter((_, i) => i !== idx));
                            setSaveState('idle');
                          }}
                          className="flex h-[42px] w-10 items-center justify-center rounded-lg text-error-500 ring-1 ring-cream-200 transition hover:bg-error-50"
                          aria-label="Remove serving size"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setServingOpts((prev) => [...prev, servingMode === 'measured' ? { quantity: '', unit: 'cl', price: '', name: '', mode: 'measured' } : { quantity: '', unit: 'cl', price: '', name: '', mode: 'named' }]);
                      setSaveState('idle');
                    }}
                    className="mt-3 flex items-center gap-1.5 text-sm font-medium text-olive-700 hover:text-olive-800"
                  >
                    <Plus className="h-4 w-4" />
                    Add serving size
                  </button>
                </div>
              ) : null}

              <div className="mt-4 rounded-xl bg-cream-50 p-4 ring-1 ring-cream-200">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Variants</p>
                <p className="mt-0.5 text-xs text-ink-faint">
                  Choices visitors must pick one of. Each extra price is added to this dish's price.
                </p>
                <div className="mt-2 space-y-2">
                  {variantDrafts.map((variant, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_7rem_auto] items-center gap-2">
                      <Input
                        value={variant.name}
                        placeholder="Option name"
                        aria-label="Variant name"
                        onChange={(e) => {
                          setVariantDrafts((prev) => prev.map((o, i) => i === idx ? { ...o, name: e.target.value } : o));
                          setSaveState('idle');
                        }}
                      />
                      <Input
                        value={variant.additionalPrice}
                        placeholder="0"
                        inputMode="decimal"
                        aria-label="Extra price"
                        onChange={(e) => {
                          setVariantDrafts((prev) => prev.map((o, i) => i === idx ? { ...o, additionalPrice: e.target.value } : o));
                          setSaveState('idle');
                        }}
                      />
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveVariant(idx, -1)}
                          disabled={idx === 0}
                          className="flex h-[42px] w-8 items-center justify-center rounded-lg text-ink-soft ring-1 ring-cream-200 transition hover:bg-cream-100 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Move variant up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveVariant(idx, 1)}
                          disabled={idx === variantDrafts.length - 1}
                          className="flex h-[42px] w-8 items-center justify-center rounded-lg text-ink-soft ring-1 ring-cream-200 transition hover:bg-cream-100 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Move variant down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setVariantDrafts((prev) => prev.filter((_, i) => i !== idx));
                            setSaveState('idle');
                          }}
                          className="flex h-[42px] w-8 items-center justify-center rounded-lg text-error-500 ring-1 ring-cream-200 transition hover:bg-error-50"
                          aria-label="Remove variant"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setVariantDrafts((prev) => [...prev, { name: '', additionalPrice: '0' }]);
                    setSaveState('idle');
                  }}
                  className="mt-3 flex items-center gap-1.5 text-sm font-medium text-olive-700 hover:text-olive-800"
                >
                  <Plus className="h-4 w-4" />
                  Add variant
                </button>
              </div>

              <div className="mt-4 rounded-xl bg-cream-50 p-4 ring-1 ring-cream-200">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  Removable ingredients
                </p>
                <p className="mt-0.5 text-xs text-ink-faint">
                  Ingredients visitors can ask to leave out.
                </p>
                <div className="mt-2 space-y-2">
                  {removableIngs.map((ing, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={ing.label}
                        placeholder="e.g. Onion"
                        onChange={(e) => {
                          setRemovableIngs((prev) => prev.map((o, i) => i === idx ? { ...o, label: e.target.value } : o));
                          setSaveState('idle');
                        }}
                        className="flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setRemovableIngs((prev) => prev.filter((_, i) => i !== idx));
                          setSaveState('idle');
                        }}
                        className="flex h-[42px] w-10 shrink-0 items-center justify-center rounded-lg text-error-500 ring-1 ring-cream-200 transition hover:bg-error-50"
                        aria-label="Remove ingredient"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Input
                    value={newIngredient}
                    placeholder="Add an ingredient…"
                    onChange={(e) => setNewIngredient(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const trimmed = newIngredient.trim();
                        if (!trimmed) return;
                        const exists = removableIngs.some((i) => i.label.trim().toLowerCase() === trimmed.toLowerCase());
                        if (!exists) {
                          setRemovableIngs((prev) => [...prev, { label: trimmed }]);
                          setSaveState('idle');
                        }
                        setNewIngredient('');
                      }
                    }}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = newIngredient.trim();
                      if (!trimmed) return;
                      const exists = removableIngs.some((i) => i.label.trim().toLowerCase() === trimmed.toLowerCase());
                      if (!exists) {
                        setRemovableIngs((prev) => [...prev, { label: trimmed }]);
                        setSaveState('idle');
                      }
                      setNewIngredient('');
                    }}
                    className="flex h-[42px] w-10 shrink-0 items-center justify-center rounded-lg bg-olive-700 text-white transition hover:bg-olive-800"
                    aria-label="Add ingredient"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <Field label="Availability" htmlFor={`${fieldIdPrefix}-available`} className="mt-4">
                <Select
                  id={`${fieldIdPrefix}-available`}
                  value={available ? 'true' : 'false'}
                  onChange={(event) => {
                    setAvailable(event.target.value === 'true');
                    setSaveState('idle');
                  }}
                >
                  <option value="true">Available</option>
                  <option value="false">Sold out</option>
                </Select>
              </Field>

              <Field label="Description" htmlFor={`${fieldIdPrefix}-description`} className="mt-4">
                <Textarea
                  id={`${fieldIdPrefix}-description`}
                  className="min-h-[80px]"
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value);
                    setSaveState('idle');
                  }}
                />
              </Field>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Ingredients" htmlFor={`${fieldIdPrefix}-ingredients`}>
                  <Textarea
                    id={`${fieldIdPrefix}-ingredients`}
                    className="min-h-[70px]"
                    value={ingredients}
                    onChange={(event) => {
                      setIngredients(event.target.value);
                      setSaveState('idle');
                    }}
                  />
                </Field>
                <Field label="Allergy" htmlFor={`${fieldIdPrefix}-allergy`}>
                  <Textarea
                    id={`${fieldIdPrefix}-allergy`}
                    className="min-h-[70px]"
                    value={allergy}
                    onChange={(event) => {
                      setAllergy(event.target.value);
                      setSaveState('idle');
                    }}
                  />
                </Field>
              </div>

              {error ? <Notice tone="error" className="mt-4">{error}</Notice> : null}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button onClick={handleSave} disabled={(!dirty && !isNew) || saveState === 'saving'} size="sm">
                  <Save className="h-4 w-4" />
                  {saveState === 'saving' ? 'Saving…' : isNew ? 'Save new dish' : 'Save'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={isNew ? onCancelNew : cancelEditing}
                  disabled={saveState === 'saving'}
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-semibold tracking-tight text-ink">
                    {emptyLabel(dish!.name, 'Untitled dish')}
                  </h3>
                  {dish!.servingOptions && dish!.servingOptions.length > 0 ? (
                    <p className="mt-1 text-sm font-medium text-olive-700">
                      {dish!.servingOptions.map((o) => `${o.label} ${formatPriceInput(o.price, cur)}`).join(' · ')}
                    </p>
                  ) : dish!.price ? (
                    <p className="mt-1 text-sm font-medium text-olive-700">{formatPriceInput(dish!.price, cur)}</p>
                  ) : null}
                </div>
                <Button variant="secondary" size="sm" onClick={startEditing} className="shrink-0">
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Section &amp; Category
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge tone="olive">{sectionLabel(dish!.section)}</Badge>
                    <Badge tone="olive">{categoryLabel(dish!.category)}</Badge>
                    {dish!.available ? (
                      <Badge tone="success">Available</Badge>
                    ) : (
                      <Badge tone="warning">Sold out</Badge>
                    )}
                  </div>
                </div>
                {!isDrinkSection(dish!.section) && !(dish!.servingOptions && dish!.servingOptions.length > 0) ? (
                  <ReadOnlyRow label="Serving size" value={dish!.serving} />
                ) : null}
                {showSavedAbv ? <ReadOnlyRow label="Alcohol" value={dish!.abv} /> : null}
                <ReadOnlyRow label="Description" value={dish!.description} />
                <ReadOnlyRow label="Ingredients" value={dish!.ingredients} />
                <ReadOnlyRow label="Allergy" value={dish!.allergy} />

                {dish!.servingOptions && dish!.servingOptions.length > 0 ? (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                      Serving options
                    </p>
                    <div className="mt-1 space-y-1">
                      {dish!.servingOptions.map((opt) => (
                        <p key={opt.id} className="text-sm leading-relaxed text-ink-soft">
                          {opt.label} — {formatPriceInput(opt.price, cur)}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}

                {dish!.variants.length > 0 ? (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                      Variants
                    </p>
                    <div className="mt-1 space-y-1">
                      {dish!.variants.map((variant) => (
                        <p key={variant.id} className="text-sm leading-relaxed text-ink-soft">
                          {variant.name} — {variantPriceLabel(variant.additionalPrice, cur)}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}

                {dish!.removableIngredients && dish!.removableIngredients.length > 0 ? (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                      Removable ingredients
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {dish!.removableIngredients.map((ing) => (
                        <span key={ing.id} className="inline-flex items-center rounded-full bg-cream-100 px-2.5 py-1 text-xs font-medium text-ink-soft ring-1 ring-cream-200">
                          {ing.label}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                      Removable ingredients
                    </p>
                    <p className="mt-0.5 text-sm text-ink-faint">0 items</p>
                  </div>
                )}
              </div>

              {saveState === 'saved' ? (
                <span className="mt-4 inline-flex animate-pop items-center gap-1.5 text-sm font-medium text-success-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Saved
                </span>
              ) : null}

              {error ? <Notice tone="error" className="mt-4">{error}</Notice> : null}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={saveState === 'saving'}
                  onClick={async () => {
                    const next = !dish!.available;
                    setAvailable(next);
                    setSaveState('saving');
                    try {
                      await onSave({ name, description, ingredients, allergy, price, category, section, serving, abv, available: next });
                      setSaveState('saved');
                    } catch (err) {
                      setAvailable(dish!.available);
                      setSaveState('idle');
                      setError(err instanceof Error ? err.message : 'Could not update availability.');
                    }
                  }}
                >
                  {dish!.available ? 'Mark as sold out' : 'Mark as available'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-ink-muted"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Remove this dish?"
        confirmLabel="Remove dish"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
        busy={deleting}
      >
        <p>
          You are about to remove <span className="font-medium text-ink">{dish?.name || 'this dish'}</span> from
          your menu. This action cannot be undone.
        </p>
      </ConfirmDialog>
    </article>
  );
}

function variantPriceLabel(additionalPrice: string, currency: string): string {
  return parsePriceToMinor(additionalPrice) === 0
    ? 'no extra charge'
    : `+ ${formatPriceInput(additionalPrice, currency)}`;
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  const hasValue = value.trim().length > 0;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={cn('mt-0.5 text-sm leading-relaxed', hasValue ? 'text-ink-soft' : 'text-ink-faint')}>
        {hasValue ? value : 'Not provided'}
      </p>
    </div>
  );
}
