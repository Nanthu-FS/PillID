// RxNorm normalization via NIH RxNav (the RxNorm endpoints are still live;
// only the separate Drug Interaction API was retired by NLM in Jan 2024).

const RXNAV = 'https://rxnav.nlm.nih.gov/REST';

export interface RxNormHit {
  rxcui: string | null;
  name: string | null;
}

/**
 * Resolve a free-text drug name to an RxNorm concept (rxcui + canonical name).
 * Tries an exact rxcui lookup first, then approximateTerm for fuzzy matches.
 */
export async function normalizeDrug(name: string): Promise<RxNormHit> {
  const clean = name.trim();
  if (!clean) return { rxcui: null, name: null };

  // 1) Exact name → rxcui
  try {
    const r = await fetch(
      `${RXNAV}/rxcui.json?name=${encodeURIComponent(clean)}&search=2`,
      { cache: 'no-store' },
    );
    if (r.ok) {
      const j = (await r.json()) as { idGroup?: { rxnormId?: string[] } };
      const id = j.idGroup?.rxnormId?.[0];
      if (id) {
        const canonical = await rxcuiName(id);
        return { rxcui: id, name: canonical ?? clean };
      }
    }
  } catch {
    /* fall through to approximate */
  }

  // 2) Approximate match
  try {
    const r = await fetch(
      `${RXNAV}/approximateTerm.json?term=${encodeURIComponent(clean)}&maxEntries=1`,
      { cache: 'no-store' },
    );
    if (r.ok) {
      const j = (await r.json()) as {
        approximateGroup?: { candidate?: { rxcui?: string; name?: string }[] };
      };
      const c = j.approximateGroup?.candidate?.[0];
      if (c?.rxcui) {
        const canonical = c.name ?? (await rxcuiName(c.rxcui));
        return { rxcui: c.rxcui, name: canonical ?? clean };
      }
    }
  } catch {
    /* give up gracefully */
  }

  return { rxcui: null, name: clean };
}

async function rxcuiName(rxcui: string): Promise<string | null> {
  try {
    const r = await fetch(`${RXNAV}/rxcui/${rxcui}/property.json?propName=RxNorm%20Name`, {
      cache: 'no-store',
    });
    if (!r.ok) return null;
    const j = (await r.json()) as {
      propConceptGroup?: { propConcept?: { propValue?: string }[] };
    };
    return j.propConceptGroup?.propConcept?.[0]?.propValue ?? null;
  } catch {
    return null;
  }
}
