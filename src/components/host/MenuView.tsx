import { useMemo, useRef, useState } from 'react';
import { Filter, FileUp, Loader2, Plus, ScrollText, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { Select } from '@/components/ui/Input';
import { ComboManager } from '@/components/host/ComboManager';
import { DishCard, type ServingOptionInput, type RemovableIngredientInput, type VariantInput } from '@/components/host/DishCard';
import { callFunction } from '@/lib/functions';
import { createDish, deleteDish, replaceServingOptions, replaceRemovableIngredients, replaceVariants, updateDish, uploadMenuFile as uploadMenuFileDefault } from '@/lib/portal';
import type { Dish } from '@/types';

type DishPatch = Pick<Dish, 'name' | 'description' | 'ingredients' | 'allergy' | 'price' | 'category' | 'section' | 'serving' | 'abv' | 'available'>;
import { SECTIONS, categoriesForSection, categoryBelongsToSection, categoryLabel, sectionLabel } from '@/lib/menuSections';

interface ExtractResult {
  dishes: Dish[];
  truncated?: boolean;
  skipped?: number;
}

interface MenuViewProps {
  restaurantId: string;
  dishes: Dish[];
  loading: boolean;
  currency?: string;
  onReload: () => Promise<void>;
  onCreateDish?: (patch: DishPatch, servingOptions?: ServingOptionInput[], removableIngredients?: RemovableIngredientInput[], variants?: VariantInput[]) => Promise<string | void>;
  onSaveDish?: (dishId: string, patch: DishPatch, servingOptions?: ServingOptionInput[], removableIngredients?: RemovableIngredientInput[], variants?: VariantInput[]) => Promise<void>;
  onDeleteDish?: (dishId: string) => Promise<void>;
  onGenerateImage?: (dishId: string) => Promise<void>;
  uploadMenuFile?: (file: File) => Promise<{ objectPath: string }>;
  departmentId?: string;
  eventId?: string;
}

const SECTION_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All sections' },
  { value: 'food', label: 'Food' },
  { value: 'drinks', label: 'Drinks' },
  { value: 'add_on', label: 'Add-on' },
  { value: 'combo', label: 'Combos' },
];

const AVAILABILITY_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All availability' },
  { value: 'available', label: 'Available' },
  { value: 'sold_out', label: 'Sold out' },
];

export function MenuView({ restaurantId, dishes, loading, currency, onReload, onCreateDish, onSaveDish, onDeleteDish, onGenerateImage, uploadMenuFile: uploadFn, departmentId, eventId }: MenuViewProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [sectionFilter, setSectionFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const showCombos = sectionFilter === 'combo';
  const [newComboRequest, setNewComboRequest] = useState(0);

  const categoryFilterOptions = useMemo(() => {
    if (sectionFilter === 'all') return SECTIONS.flatMap((s) => s.categories);
    return categoriesForSection(sectionFilter);
  }, [sectionFilter]);

  function handleSectionFilterChange(newSection: string) {
    setSectionFilter(newSection);
    if (categoryFilter !== 'all') {
      if (newSection !== 'all' && !categoryBelongsToSection(categoryFilter, newSection)) {
        setCategoryFilter('all');
      }
    }
  }

  const filteredDishes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const matched = dishes.filter((dish) => {
      if (sectionFilter !== 'all' && dish.section !== sectionFilter) return false;
      if (categoryFilter !== 'all' && dish.category !== categoryFilter) return false;
      if (availabilityFilter === 'available' && !dish.available) return false;
      if (availabilityFilter === 'sold_out' && dish.available) return false;
      if (query && !dish.name.toLowerCase().includes(query)) return false;
      return true;
    });
    // Section-aware ordering: food dishes first, then drinks, preserving the
    // existing sortOrder within each section. This keeps new dishes next to
    // their section peers instead of appended after the other section.
    const sectionRank: Record<string, number> = { food: 0, drinks: 1, add_on: 2 };
    return [...matched].sort((a, b) => {
      const ra = sectionRank[a.section] ?? 2;
      const rb = sectionRank[b.section] ?? 2;
      if (ra !== rb) return ra - rb;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });
  }, [dishes, sectionFilter, categoryFilter, availabilityFilter, searchQuery]);

  // Display-only grouping: the already-filtered, sortOrder-ordered dishes are
  // partitioned into the three sections and, within each section, into the
  // canonical category order. Dishes with a category outside the canonical
  // list fall into a trailing "Other" group so none are ever hidden.
  const groupedDishes = useMemo(() => {
    const sectionRank: Record<string, number> = { food: 0, drinks: 1, add_on: 2 };
    return (['food', 'drinks', 'add_on'] as const)
      .map((section) => {
        const sectionDishes = filteredDishes.filter((dish) => (dish.section ?? 'food') === section);
        const groups = categoriesForSection(section)
          .map((category) => ({
            category: category.value,
            label: category.label,
            dishes: sectionDishes.filter((dish) => dish.category === category.value),
          }))
          .filter((group) => group.dishes.length > 0);
        const known = new Set(groups.map((group) => group.category));
        const other = sectionDishes.filter((dish) => !known.has(dish.category));
        if (other.length > 0) groups.push({ category: 'other', label: 'Other', dishes: other });
        return { section, label: sectionLabel(section), rank: sectionRank[section] ?? 2, groups };
      })
      .filter((entry) => entry.groups.length > 0)
      .sort((a, b) => a.rank - b.rank);
  }, [filteredDishes]);

  async function handleFile(file: File) {
    setUploadError(null);
    setUploadSuccess(null);
    setUploadWarning(null);
    setReading(true);
    try {
      const { objectPath } = await (uploadFn ?? uploadMenuFileDefault)(file, restaurantId);
      const result = await callFunction<ExtractResult>('menu-extract', {
        restaurantId,
        objectPath,
        mimeType: file.type,
        fileName: file.name,
        departmentId,
        eventId,
      });
      await onReload();
      const count = result.dishes.length;
      const skipped = result.skipped ?? 0;
      if (count === 0 && skipped > 0) {
        setUploadSuccess(
          `${skipped} item${skipped === 1 ? '' : 's'} from ${file.name} ${skipped === 1 ? 'is' : 'are'} already on your menu, so nothing was added.`
        );
      } else {
        setUploadSuccess(
          `Read ${count} item${count === 1 ? '' : 's'} from ${file.name}${skipped > 0 ? `, skipping ${skipped} already on your menu` : ''}. Review them below.`
        );
      }
      if (result.truncated) {
        setUploadWarning(
          'This menu was longer than we could read in one pass, so the last few items may be missing. Check the list below and upload the rest separately if needed.'
        );
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Could not read that menu.');
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleSaveDish(dishId: string, patch: DishPatch, servingOptions?: ServingOptionInput[], removableIngredients?: RemovableIngredientInput[], variants?: VariantInput[]) {
    if (onSaveDish) { await onSaveDish(dishId, patch, servingOptions, removableIngredients, variants); return; }
    await updateDish(dishId, patch);
    if (servingOptions && servingOptions.length > 0) {
      await replaceServingOptions(dishId, servingOptions);
    }
    if (removableIngredients) {
      await replaceRemovableIngredients(dishId, removableIngredients);
    }
    if (variants) {
      await replaceVariants(dishId, variants);
    }
    await onReload();
  }

  async function handleCreateDish(patch: DishPatch, servingOptions?: ServingOptionInput[], removableIngredients?: RemovableIngredientInput[], variants?: VariantInput[]): Promise<string | void> {
    if (onCreateDish) { return await onCreateDish(patch, servingOptions, removableIngredients, variants); }
    const dish = await createDish({ restaurantId }, patch);
    if (servingOptions && servingOptions.length > 0) {
      await replaceServingOptions(dish.id, servingOptions);
    }
    if (removableIngredients) {
      await replaceRemovableIngredients(dish.id, removableIngredients);
    }
    if (variants) {
      await replaceVariants(dish.id, variants);
    }
    await onReload();
    return dish.id;
  }

  async function handleGenerateImage(dishId: string) {
    if (onGenerateImage) { await onGenerateImage(dishId); return; }
    await callFunction<{ imageUrl: string }>('dish-image', {
      restaurantId,
      dishId,
      clientRequestId: crypto.randomUUID(),
    });
    await onReload();
  }

  async function handleDeleteDish(dishId: string) {
    if (onDeleteDish) { await onDeleteDish(dishId); return; }
    await deleteDish(dishId);
    await onReload();
  }

  return (
    <div className="space-y-6">
      <Card className="animate-fade-in">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-olive-100 text-olive-700">
            <FileUp className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
              Upload a menu
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Add a menu photo or PDF. We read it and turn it into editable dish cards below.
            </p>

            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={() => inputRef.current?.click()} disabled={reading}>
                {reading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Reading menu…
                  </>
                ) : (
                  <>
                    <FileUp className="h-4 w-4" />
                    Choose menu file
                  </>
                )}
              </Button>
              <span className="text-xs text-ink-faint">PDF, JPG, or PNG</span>
            </div>

            {uploadError ? <Notice tone="error" className="mt-4">{uploadError}</Notice> : null}
            {uploadSuccess ? <Notice tone="success" className="mt-4">{uploadSuccess}</Notice> : null}
            {uploadWarning ? <Notice tone="info" className="mt-4">{uploadWarning}</Notice> : null}
          </div>
        </div>
      </Card>

      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
              Saved dishes
            </h2>
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                onClick={() => setAdding(true)}
                disabled={adding || loading}
              >
                <Plus className="h-4 w-4" />
                Add dish
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setNewComboRequest((count) => count + 1)}
              >
                <Plus className="h-4 w-4" />
                New combo
              </Button>
            </div>
          </div>
          <span className="text-sm text-ink-muted">
            {dishes.length} {dishes.length === 1 ? 'dish' : 'dishes'}
          </span>
        </div>

        {dishes.length > 0 || showCombos ? (
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-muted">
              <Filter className="h-3.5 w-3.5" />
              Filter
            </span>
            <Select
              aria-label="Filter by section"
              className="w-auto"
              value={sectionFilter}
              onChange={(event) => handleSectionFilterChange(event.target.value)}
            >
              {SECTION_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            {!showCombos ? (
              <>
            <Select
              aria-label="Filter by category"
              className="w-auto"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="all">All categories</option>
              {categoryFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filter by availability"
              className="w-auto"
              value={availabilityFilter}
              onChange={(event) => setAvailabilityFilter(event.target.value)}
            >
              {AVAILABILITY_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
              </>
            ) : null}
          </div>
        ) : null}

        {dishes.length > 0 && !showCombos ? (
          <div className="mb-4 relative max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint drop-shadow-sm" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by name"
              className="w-full rounded-lg border border-cream-200 bg-white py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-olive-400 focus:outline-none focus:ring-2 focus:ring-olive-100"
            />
          </div>
        ) : null}

        <ComboManager
          restaurantId={restaurantId}
          departmentId={departmentId}
          eventId={eventId}
          currency={currency}
          showList={showCombos}
          newComboRequest={newComboRequest}
        />

        {!showCombos && adding ? (
          <DishCard
            dish={null}
            index={0}
            isNew
            currency={currency}
            onSave={handleCreateDish}
            onCancelNew={() => setAdding(false)}
            onGenerateImage={() => Promise.resolve()}
          />
        ) : null}

        {showCombos ? null : loading ? (
          <Card className="flex items-center justify-center gap-2 py-14 text-sm text-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading your menu…
          </Card>
        ) : dishes.length === 0 && !adding ? (
          <Card className="flex flex-col items-center py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cream-100 text-olive-600">
              <ScrollText className="h-6 w-6" />
            </span>
            <p className="mt-4 text-sm font-medium text-ink">No dishes saved yet</p>
            <p className="mt-1 max-w-sm text-sm text-ink-muted">
              Upload a menu photo or PDF above, or click <span className="font-medium text-ink-soft">Add dish</span> to create one manually.
            </p>
          </Card>
        ) : (
          <>
            {filteredDishes.length === 0 ? (
              <Card className="flex flex-col items-center py-14 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cream-100 text-olive-600">
                  <Filter className="h-6 w-6" />
                </span>
                <p className="mt-4 text-sm font-medium text-ink">No dishes match these filters</p>
                <p className="mt-1 max-w-sm text-sm text-ink-muted">
                  Try changing or resetting the filters above.
                </p>
              </Card>
            ) : (
              <div className="space-y-8">
                {groupedDishes.map((sectionEntry) => (
                  <div key={sectionEntry.section} className="space-y-4">
                    <h3 className="font-display text-base font-semibold tracking-tight text-ink">
                      {sectionEntry.label}
                    </h3>
                    {sectionEntry.groups.map((group) => (
                      <div key={group.category} className="space-y-3">
                        <h4 className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                          {group.label}
                        </h4>
                        <div className="space-y-4">
                          {group.dishes.map((dish) => (
                            <DishCard
                              key={dish.id}
                              dish={dish}
                              index={filteredDishes.indexOf(dish)}
                              currency={currency}
                              onSave={(patch, servingOptions, removableIngredients, variants) => handleSaveDish(dish.id, patch, servingOptions, removableIngredients, variants)}
                              onGenerateImage={() => handleGenerateImage(dish.id)}
                              onDelete={() => handleDeleteDish(dish.id)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
