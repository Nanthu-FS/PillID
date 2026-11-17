// openFDA drug-label lookups. This is the FACTUAL source for warnings and
// interaction text — the model never invents these fields.

import type { LabelData } from './types';

const OPENFDA = 'https://api.fda.gov/drug/label.json';
const TIMEOUT_MS = 8000;

function joined(v: unknown): string | null {
  if (Array.isArray(v)) {
    const s = v.map((x) => String(x).trim()).filter(Boolean).join('\n\n');
    return s || null;
  }
  if (typeof v === 'string') return v.trim() || null;
  return null;
}

interface OpenFdaResult {
  openfda?: { brand_name?: string[]; generic_name?: string[] };
  purpose?: string[];
  indications_and_usage?: string[];
  boxed_warning?: string[];
  warnings?: string[];
  warnings_and_cautions?: string[];
  drug_interactions?: string[];
  dosage_and_administration?: string[];
}

const norm = (s: string) => s.trim().toLowerCase();

/** Prefer a label that is exactly this drug over a combination product. */
function pickBest(results: OpenFdaResult[], name: string, field: 'generic_name' | 'brand_name') {
  const target = norm(name);
  const exact = results.find((r) => {
    const names = r.openfda?.[field] ?? [];
    return names.length === 1 && norm(names[0]) === target;
  });
  if (exact) return exact;
  // A single-ingredient label whose name merely contains the term (e.g. a salt form).
  const single = results.find((r) => {
    const names = r.openfda?.generic_name ?? [];
    return names.length === 1 && !/,| and | \/ /i.test(names[0]);
  });
  return single ?? results[0];
}

/**
 * Fetch a label for a drug name. Matches the label's generic name first, then
 * its brand name — always as an exact phrase on the openFDA name fields. There
 * is deliberately no free-text fallback: a label that merely mentions the name
 * somewhere is the wrong label. Returns null if openFDA has no match.
 */
export async function fetchLabel(name: string): Promise<LabelData | null> {
  const clean = name.trim().replace(/["\\]/g, '');
  if (!clean) return null;

  const fields = ['generic_name', 'brand_name'] as const;
  for (const field of fields) {
    try {
      const search = encodeURIComponent(`openfda.${field}:"${clean}"`);
      const r = await fetch(`${OPENFDA}?search=${search}&limit=10`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!r.ok) continue; // 404 = no match for this field
      const j = (await r.json()) as { results?: OpenFdaResult[] };
      if (!j.results?.length) continue;
      const hit = pickBest(j.results, clean, field);
      return {
        brand_name: joined(hit.openfda?.brand_name?.[0]),
        generic_name: joined(hit.openfda?.generic_name?.[0]),
        purpose: joined(hit.purpose) ?? joined(hit.indications_and_usage),
        boxed_warning: joined(hit.boxed_warning),
        warnings: joined(hit.warnings),
        warnings_and_cautions: joined(hit.warnings_and_cautions),
        drug_interactions: joined(hit.drug_interactions),
        dosage_and_administration: joined(hit.dosage_and_administration),
        source: 'openfda',
      };
    } catch {
      /* try next field */
    }
  }
  return null;
}

/** The label sections that can state an interaction, in priority order. */
export function interactionText(label: LabelData | null | undefined): string {
  if (!label) return '';
  const parts: [string, string | null | undefined][] = [
    ['Boxed warning', label.boxed_warning],
    ['Drug interactions', label.drug_interactions],
    ['Warnings', label.warnings],
    ['Warnings and precautions', label.warnings_and_cautions],
  ];
  return parts
    .filter(([, text]) => text)
    .map(([title, text]) => `## ${title}\n${text}`)
    .join('\n\n');
}
