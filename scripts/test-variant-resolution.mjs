import { readFileSync } from 'fs';

const src = readFileSync('supabase/functions/menu-extract/index.ts', 'utf8');
const lines = src.split('\n');
const block = lines.slice(130, 472).join('\n');

// Strip TypeScript-only syntax so the block runs under plain Node.
const code = block
  .replace(/: Section\b/g, '')
  .replace(/: Category\b/g, '')
  .replace(/: DishDraft\[\]/g, '')
  .replace(/: DishDraft\b/g, '')
  .replace(/: GroupedDraft\[\]/g, '')
  .replace(/: GroupedDraft\b/g, '')
  .replace(/: VariantChoice\[\]/g, '')
  .replace(/: VariantChoice\b/g, '')
  .replace(/: VariantChoice \| null/g, '')
  .replace(/let defaultChoice \| null/g, 'let defaultChoice')
  .replace(/: ServingMeasurement \| null/g, '')
  .replace(/: Set<string>/g, '')
  .replace(/: Map<string, number>/g, '')
  .replace(/: Map<string, DishDraft\[\]>/g, '')
  .replace(/: Map<GroupedDraft, VariantChoice\[\]>/g, '')
  .replace(/<string, number>/g, '')
  .replace(/<string, DishDraft\[\]>/g, '')
  .replace(/<string>/g, '')
  .replace(/<GroupedDraft, VariantChoice\[\]>/g, '')
  .replace(/: string/g, '')
  .replace(/: number/g, '')
  .replace(/: unknown/g, '')
  .replace(/: boolean/g, '')
  .replace(/: 'cl' \| 'ml' \| 'oz'/g, '')
  .replace(/\): ResolvedExtraction \{/g, ') {')
  .replace(/as 'cl' \| 'ml' \| 'oz'/g, '')
  .replace(/interface DishDraft[\s\S]*?\n\}/, '')
  .replace(/interface VariantOption[\s\S]*?\n\}/, '')
  .replace(/interface ServingMeasurement[\s\S]*?\n\}/, '')
  .replace(/interface VariantChoice[\s\S]*?\n\}/, '')
  .replace(/interface GroupedDraft[\s\S]*?\n\}/, '')
  .replace(/interface ResolvedExtraction[\s\S]*?\n\}/, '')
  // the splitTrailingPortion body already returns a plain object literal, so
  // only its typed return annotation needs stripping
  .replace(/\): \{ base; portion \} \| null \{/g, ') {');

const harness = code + `
;globalThis.__exports = { resolveDishesAndVariants, withDefaultVariant, isZeroExtraPrice, isDefaultVariantName, normalizeName };`;

const fns = new Function(harness + '; return { resolveDishesAndVariants, withDefaultVariant, isZeroExtraPrice };')();
globalThis.resolveDishesAndVariants = fns.resolveDishesAndVariants;
globalThis.withDefaultVariant = fns.withDefaultVariant;
globalThis.isZeroExtraPrice = fns.isZeroExtraPrice;

const draft = (name, price, o = {}) => ({
  name,
  section: o.section || 'food',
  category: o.category || 'main_courses',
  description: o.description || '',
  ingredients: '',
  allergy: '',
  price,
  serving: o.serving || '',
  abv: '',
  variantOf: o.variantOf || '',
  variant: o.variant || '',
  additionalPrice: o.additionalPrice || '',
});
const findDish = (fresh, name) => fresh.find((g) => g.draft.name === name);
const choicesOf = (resolved, name) => {
  const g = findDish(resolved.fresh, name);
  return g ? resolved.variantChoices.get(g) || [] : [];
};

const tests = [];
const t = (label, fn) => {
  try {
    fn();
    tests.push(['PASS', label]);
  } catch (e) {
    tests.push(['FAIL', label + ' :: ' + e.message]);
  }
};

t('explicit variant_of attaches to parent', () => {
  const r = resolveDishesAndVariants(
    [
      draft('Pad Thai', 'SEK 120'),
      draft('Pad Thai Beef', 'SEK 20', { variantOf: 'Pad Thai', variant: 'Beef', additionalPrice: '20' }),
    ],
    new Set()
  );
  if (r.fresh.length !== 1) throw new Error('fresh=' + r.fresh.length);
  const c = choicesOf(r, 'Pad Thai');
  if (c.length !== 2) throw new Error(JSON.stringify(c));
  if (c[0].name !== 'Standard' || !isZeroExtraPrice(c[0].additionalPrice)) throw new Error(JSON.stringify(c));
  if (c[1].name !== 'Beef' || c[1].additionalPrice !== '20') throw new Error(JSON.stringify(c));
});

t('orphan cluster attaches to matching dish row (Cafe Frappe shape)', () => {
  const r = resolveDishesAndVariants(
    [
      draft('Cafe Frappe', 'SEK 49'),
      draft('Cafe Frappe', 'SEK 57', { variant: 'Oat milk', additionalPrice: 'SEK 8' }),
      draft('Cafe Frappe', 'SEK 59', { variant: 'Almond milk', additionalPrice: 'SEK 10' }),
    ],
    new Set()
  );
  if (r.fresh.length !== 1) throw new Error('fresh=' + r.fresh.length);
  const c = choicesOf(r, 'Cafe Frappe');
  if (c.length !== 3) throw new Error(JSON.stringify(c));
  if (!isZeroExtraPrice(c[0].additionalPrice)) throw new Error('default first: ' + JSON.stringify(c));
  const rest = c.slice(1).map((x) => x.name).sort();
  if (rest.join(',') !== 'Almond milk,Oat milk') throw new Error(JSON.stringify(c));
});

t('orphan cluster forms dish when no dish row extracted', () => {
  const r = resolveDishesAndVariants(
    [
      draft('Cafe Frappe', 'SEK 49', { variant: 'Standard milk', additionalPrice: '0' }),
      draft('Cafe Frappe', 'SEK 57', { variant: 'Oat milk', additionalPrice: 'SEK 8' }),
      draft('Cafe Frappe', 'SEK 59', { variant: 'Almond milk', additionalPrice: 'SEK 10' }),
    ],
    new Set()
  );
  if (r.fresh.length !== 1) throw new Error('fresh=' + r.fresh.length);
  if (r.fresh[0].draft.price !== 'SEK 49') throw new Error('price=' + r.fresh[0].draft.price);
  const c = r.variantChoices.get(r.fresh[0]) || [];
  if (c.length !== 3 || c[0].name !== 'Standard milk') throw new Error(JSON.stringify(c));
});

t('multiple parents keep variants separated', () => {
  const r = resolveDishesAndVariants(
    [
      draft('Latte', 'SEK 40'),
      draft('Latte', 'SEK 48', { variant: 'Oat milk', additionalPrice: '8' }),
      draft('Mocha', 'SEK 45'),
      draft('Mocha', 'SEK 53', { variant: 'Soya milk', additionalPrice: '8' }),
    ],
    new Set()
  );
  if (r.fresh.length !== 2) throw new Error('fresh=' + r.fresh.length);
  const latte = choicesOf(r, 'Latte');
  const mocha = choicesOf(r, 'Mocha');
  if (latte.length !== 2 || latte[1].name !== 'Oat milk' || latte[0].name !== 'Standard')
    throw new Error(JSON.stringify(latte));
  if (mocha.length !== 2 || mocha[1].name !== 'Soya milk' || mocha[0].name !== 'Standard')
    throw new Error(JSON.stringify(mocha));
});

t('lone orphan row with no dish match stays standalone (no guessing)', () => {
  const r = resolveDishesAndVariants(
    [
      draft('Spicy Tuna Roll', 'SEK 95'),
      draft('Wasabi', 'SEK 10', { variant: 'Extra hot', additionalPrice: '10' }),
    ],
    new Set()
  );
  if (!findDish(r.fresh, 'Wasabi')) throw new Error('Wasabi missing');
  if (choicesOf(r, 'Wasabi').length !== 0) throw new Error('should have no variants');
  if (choicesOf(r, 'Spicy Tuna Roll').length !== 0) throw new Error('must not guess parent');
});

t('plain standalone dish unaffected', () => {
  const r = resolveDishesAndVariants([draft('Garlic Naan', 'SEK 25')], new Set());
  if (r.fresh.length !== 1 || choicesOf(r, 'Garlic Naan').length !== 0) throw new Error('changed');
});

t('duplicate defaults collapse, default first', () => {
  const c = withDefaultVariant([
    { name: 'Standard milk', additionalPrice: '0' },
    { name: 'standard milk', additionalPrice: '0' },
    { name: 'Oat milk', additionalPrice: '8' },
    { name: 'Regular milk', additionalPrice: '0' },
  ]);
  if (c.length !== 3) throw new Error(JSON.stringify(c));
  if (c[0].name !== 'Standard milk' || !isZeroExtraPrice(c[0].additionalPrice)) throw new Error(JSON.stringify(c));
});

t('explicit path duplicate default collapses too', () => {
  const r = resolveDishesAndVariants(
    [
      draft('Tea', 'SEK 30'),
      draft('Tea a', 'SEK 30', { variantOf: 'Tea', variant: 'Standard', additionalPrice: '0' }),
      draft('Tea b', 'SEK 30', { variantOf: 'Tea', variant: 'standard', additionalPrice: '0' }),
    ],
    new Set()
  );
  const c = choicesOf(r, 'Tea');
  if (c.length !== 1) throw new Error(JSON.stringify(c));
  if (c[0].name !== 'Standard' || !isZeroExtraPrice(c[0].additionalPrice)) throw new Error(JSON.stringify(c));
});

t('orphan cluster for already-existing dish is skipped, not recreated', () => {
  const r = resolveDishesAndVariants(
    [
      draft('Cafe Frappe', 'SEK 57', { variant: 'Oat milk', additionalPrice: '8' }),
      draft('Cafe Frappe', 'SEK 59', { variant: 'Almond milk', additionalPrice: '10' }),
    ],
    new Set(['cafe frappe'])
  );
  if (r.fresh.length !== 0) throw new Error('should save nothing');
  if (r.skipped !== 2) throw new Error('skipped=' + r.skipped);
});

t('synthetic Standard added when no default option exists', () => {
  const r = resolveDishesAndVariants(
    [
      draft('Green Curry', 'SEK 130'),
      draft('Green Curry', 'SEK 140', { variant: 'Beef', additionalPrice: '10' }),
    ],
    new Set()
  );
  const c = choicesOf(r, 'Green Curry');
  if (c.length !== 2) throw new Error(JSON.stringify(c));
  if (c[0].name !== 'Standard' || !isZeroExtraPrice(c[0].additionalPrice)) throw new Error(JSON.stringify(c));
  if (c[1].name !== 'Beef') throw new Error(JSON.stringify(c));
});

for (const [status, label] of tests) console.log(status, label);
if (tests.some((x) => x[0] === 'FAIL')) {
  console.log('FAILURES_PRESENT');
  process.exit(1);
}
console.log('ALL_OK');
