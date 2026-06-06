// openFDA drug-label lookups. This is the FACTUAL source for warnings and
// interaction text — the model never invents these fields.

import type { LabelData } from './types';

const OPENFDA = 'https://api.fda.gov/drug/label.json';

function firstString(v: unknown): string | null {
  if (Array.isArray(v)) return v.length ? String(v[0]).trim() : null;
  if (typeof v === 'string') return v.trim();
  return null;
}

interface OpenFdaResult {
  openfda?: { brand_name?: string[]; generic_name?: string[] };
  purpose?: string[];
  warnings?: string[];
  drug_interactions?: string[];
  dosage_and_administration?: string[];
}

/**
 * Fetch a label for a drug name. Tries brand_name, then generic_name, then a
 * loose full-text search. Returns null if openFDA has nothing.
 */
export async function fetchLabel(name: string): Promise<LabelData | null> {
  const clean = name.trim().replace(/"/g, '');
  if (!clean) return null;

  const queries = [
    `search=openfda.brand_name:"${clean}"`,
    `search=openfda.generic_name:"${clean}"`,
    `search=${encodeURIComponent(clean)}`,
  ];

  for (const q of queries) {
    try {
      const r = await fetch(`${OPENFDA}?${q}&limit=1`, { cache: 'no-store' });
      if (!r.ok) continue;
      const j = (await r.json()) as { results?: OpenFdaResult[] };
      const hit = j.results?.[0];
      if (!hit) continue;
      return {
        brand_name: firstString(hit.openfda?.brand_name),
        generic_name: firstString(hit.openfda?.generic_name),
        purpose: firstString(hit.purpose),
        warnings: firstString(hit.warnings),
        drug_interactions: firstString(hit.drug_interactions),
        dosage_and_administration: firstString(hit.dosage_and_administration),
        source: 'openfda',
      };
    } catch {
      /* try next query */
    }
  }
  return null;
}
