export type BarcodeLookupResult = {
  barcode: string;
  name: string | null;
  source: 'openfoodfacts';
};

function normalizeName(s: any): string | null {
  const v = String(s || '').trim();
  return v ? v : null;
}

/**
 * Lookup a barcode using OpenFoodFacts.
 * Works best for food products; may return null for non-food/local items.
 */
export async function lookupBarcodeName(barcode: string): Promise<BarcodeLookupResult | null> {
  const code = String(barcode || '').trim();
  if (!code) return null;

  // API docs: https://world.openfoodfacts.org/data
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_fr,brands,quantity`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const json = await res.json().catch(() => null);
  if (!json || json.status !== 1 || !json.product) return null;

  const p = json.product;
  const name =
    normalizeName(p.product_name_fr) ||
    normalizeName(p.product_name) ||
    null;

  if (!name) return null;

  return { barcode: code, name, source: 'openfoodfacts' };
}
