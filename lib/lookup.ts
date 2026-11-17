// Grounded lookup for a drug name: RxNorm for the canonical name, then the
// openFDA label for that canonical name. No model involved.

import { normalizeDrug } from './rxnorm';
import { fetchLabel } from './openfda';
import type { DrugLookup } from './types';

export async function lookupDrug(name: string): Promise<DrugLookup> {
  const rx = await normalizeDrug(name);
  // Prefer the RxNorm-normalised name; fall back to what was typed/guessed.
  let label = rx.rxcui && rx.name ? await fetchLabel(rx.name) : null;
  if (!label && rx.name?.toLowerCase() !== name.trim().toLowerCase()) {
    label = await fetchLabel(name);
  }
  return { rxcui: rx.rxcui, canonical_name: rx.name, label };
}
