export type SectionValue = 'food' | 'drinks' | 'add_on';

export interface CategoryOption {
  value: string;
  label: string;
}

export interface SectionOption {
  value: SectionValue;
  label: string;
  categories: CategoryOption[];
}

export const SECTIONS: SectionOption[] = [
  {
    value: 'food',
    label: 'Food',
    categories: [
      { value: 'starters_appetizers', label: 'Starters / Appetizers' },
      { value: 'main_courses', label: 'Main Courses' },
      { value: 'soups', label: 'Soups' },
      { value: 'salads', label: 'Salads' },
      { value: 'sides', label: 'Sides' },
      { value: 'desserts', label: 'Desserts' },
      { value: 'kids_menu', label: "Kids' Menu" },
      { value: 'specials', label: 'Specials' },
    ],
  },
  {
    value: 'drinks',
    label: 'Drinks',
    categories: [
      { value: 'coffee_tea', label: 'Coffee & Tea' },
      { value: 'soft_drinks_water', label: 'Soft Drinks & Water' },
      { value: 'juices', label: 'Juices' },
      { value: 'mocktails', label: 'Mocktails' },
      { value: 'cocktails', label: 'Cocktails' },
      { value: 'beer_cider', label: 'Beer & Cider' },
      { value: 'wine', label: 'Wine' },
      { value: 'spirits_shots', label: 'Spirits & Shots' },
      { value: 'non_alcoholic_beer', label: 'Non-alcoholic Beer' },
    ],
  },
  {
    value: 'add_on',
    label: 'Add-on',
    categories: [
      { value: 'food_add_ons', label: 'Food Add-on' },
      { value: 'drink_add_ons', label: 'Drink Add-on' },
      { value: 'add_ons', label: 'Unassigned Add-on' },
    ],
  },
];

const ALL_CATEGORIES: CategoryOption[] = SECTIONS.flatMap((s) => s.categories);

const CATEGORY_LABEL_MAP: Record<string, string> = Object.fromEntries(
  ALL_CATEGORIES.map((c) => [c.value, c.label]),
);

const SECTION_LABEL_MAP: Record<string, string> = Object.fromEntries(
  SECTIONS.map((s) => [s.value, s.label]),
);

export function sectionLabel(value: string): string {
  return SECTION_LABEL_MAP[value] ?? 'Food';
}

export function categoryLabel(value: string): string {
  return CATEGORY_LABEL_MAP[value] ?? 'Main Courses';
}

export function categoriesForSection(section: string): CategoryOption[] {
  return SECTIONS.find((s) => s.value === section)?.categories ?? SECTIONS[0].categories;
}

export function isValidSection(value: string): value is SectionValue {
  return value === 'food' || value === 'drinks' || value === 'add_on';
}

export function categoryBelongsToSection(category: string, section: string): boolean {
  return categoriesForSection(section).some((c) => c.value === category);
}

export function isDrinkSection(section: string): boolean {
  return section === 'drinks';
}
