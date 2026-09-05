import { createHash } from 'node:crypto';

export const PARK_PLAZA_MENU_SOURCE = 'park-plaza-menu-md';

export interface MenuManifestVariant {
  sourceKey: string;
  name: string | null;
  price: string | null;
  currency: 'PEN';
  position: number;
  sourceHash: string;
}

export interface MenuManifestItem {
  sourceKey: string;
  name: string;
  position: number;
  sourceHash: string;
  variants: MenuManifestVariant[];
}

export interface MenuManifestCategory {
  sourceKey: string;
  name: string;
  position: number;
  sourceHash: string;
  items: MenuManifestItem[];
}

export interface MenuManifest {
  sourceSystem: typeof PARK_PLAZA_MENU_SOURCE;
  sourceDigest: string;
  currency: 'PEN';
  categories: MenuManifestCategory[];
  stats: {
    categoryCount: number;
    productRowCount: number;
    pricedOfferingCount: number;
    unsupportedRowCount: number;
  };
}

function digest(value: unknown): string {
  return createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

function slug(value: string): string {
  const result = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!result) throw new Error(`Cannot derive a stable source key from: ${value}`);
  return result;
}

function cells(line: string): string[] {
  return line.split('|').slice(1, -1).map((cell) => cell.trim());
}

function parsePrice(value: string): string | null {
  if (value === '—') return null;
  const match = /^S\/\s*(\d+)\.(\d{2})$/.exec(value);
  if (!match) throw new Error(`Unsupported menu price: ${value}`);
  const price = `${match[1]}.${match[2]}`;
  if (Number(price) <= 0) throw new Error(`Menu price must be positive: ${value}`);
  return price;
}

export function parseParkPlazaMenu(markdown: string): MenuManifest {
  const normalized = markdown.replace(/\r\n?/g, '\n').trim();
  if (!normalized) throw new Error('Menu source is empty');

  const lines = normalized.split('\n');
  const categories: MenuManifestCategory[] = [];
  const keys = new Set<string>();
  let section = '';
  let category: MenuManifestCategory | null = null;

  const useKey = (key: string) => {
    if (keys.has(key)) throw new Error(`Duplicate stable source key: ${key}`);
    keys.add(key);
    return key;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!.trim();
    if (line.startsWith('# ')) {
      section = line.slice(2).trim();
      category = null;
      continue;
    }
    if (line.startsWith('## ')) {
      if (!section) throw new Error('Menu category appears before a section');
      const name = line.slice(3).trim();
      const sourceKey = useKey(`section/${slug(section)}/category/${slug(name)}`);
      category = { sourceKey, name, position: categories.length, sourceHash: '', items: [] };
      categories.push(category);
      continue;
    }
    if (!line.startsWith('| Producto |')) continue;
    if (!category) throw new Error('Product table appears outside a menu category');

    const headers = cells(line);
    if (headers.length < 2 || headers[0] !== 'Producto') throw new Error(`Unsupported menu table header: ${line}`);
    const separator = lines[index + 1]?.trim() ?? '';
    if (!/^\|(?:\s*:?-+:?\s*\|)+$/.test(separator)) throw new Error(`Missing menu table separator after: ${line}`);
    index += 2;

    while (index < lines.length && lines[index]!.trim().startsWith('|')) {
      const row = cells(lines[index]!.trim());
      if (row.length !== headers.length) throw new Error(`Menu row does not match its header: ${lines[index]}`);
      const name = row[0]!;
      if (!name) throw new Error('Menu product name is empty');
      const itemKey = useKey(`${category.sourceKey}/item/${slug(name)}`);
      const variants = headers.slice(1).map((header, variantIndex) => {
        const variantName = header === 'Precio' ? null : header;
        const sourceKey = useKey(`${itemKey}/variant/${variantName ? slug(variantName) : 'standard'}`);
        const price = parsePrice(row[variantIndex + 1]!);
        const source = { sourceKey, name: variantName, price, currency: 'PEN' as const, position: variantIndex };
        return { ...source, sourceHash: digest(source) };
      });
      const itemSource = { sourceKey: itemKey, name, position: category.items.length, variants: variants.map(({ sourceHash: _hash, ...variant }) => variant) };
      category.items.push({ ...itemSource, sourceHash: digest(itemSource), variants });
      index += 1;
    }
    index -= 1;
  }

  for (const entry of categories) {
    entry.sourceHash = digest({ sourceKey: entry.sourceKey, name: entry.name, position: entry.position });
  }
  const items = categories.flatMap((entry) => entry.items);
  const manifest: MenuManifest = {
    sourceSystem: PARK_PLAZA_MENU_SOURCE,
    sourceDigest: digest(normalized),
    currency: 'PEN',
    categories,
    stats: {
      categoryCount: categories.length,
      productRowCount: items.length,
      pricedOfferingCount: items.flatMap((item) => item.variants).filter((variant) => variant.price !== null).length,
      unsupportedRowCount: items.filter((item) => item.variants.every((variant) => variant.price === null)).length,
    },
  };
  assertAuthoritativeManifest(manifest);
  return manifest;
}

function assertAuthoritativeManifest(manifest: MenuManifest): void {
  const expected = { categoryCount: 15, productRowCount: 82, pricedOfferingCount: 90, unsupportedRowCount: 2 };
  for (const [key, value] of Object.entries(expected)) {
    if (manifest.stats[key as keyof typeof expected] !== value) {
      throw new Error(`Authoritative menu validation failed for ${key}: expected ${value}, received ${manifest.stats[key as keyof typeof expected]}`);
    }
  }
}
