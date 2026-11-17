// Shared types for PillID.

export type Severity = 'minor' | 'moderate' | 'major';

/** Raw vision read from the model before enrichment. */
export interface VisionRead {
  name: string | null;        // best-guess generic or brand name
  imprint: string | null;     // imprint / debossed code
  shape: string | null;
  color: string | null;
  strength: string | null;    // e.g. "500 mg"
  dosage_form: string | null; // tablet, capsule, ...
  confidence: number;         // 0-100, self-reported by the model (not calibrated)
  reasoning: string | null;
  candidates: string[];       // alternative name guesses
}

/** A drug-label excerpt pulled from openFDA. */
export interface LabelData {
  brand_name: string | null;
  generic_name: string | null;
  purpose: string | null;
  warnings: string | null;
  drug_interactions: string | null;
  dosage_and_administration: string | null;
  // Optional: rows saved before these were fetched don't have them.
  boxed_warning?: string | null;
  warnings_and_cautions?: string | null;
  source: 'openfda';
}

/** Grounded facts for a drug name (RxNorm + openFDA), no model involved. */
export interface DrugLookup {
  rxcui: string | null;
  canonical_name: string | null;
  label: LabelData | null;
}

/** Full identification result returned by /api/identify. */
export interface Identification extends DrugLookup {
  vision: VisionRead;
}

/** A saved medication row (mirrors the Supabase `medications` table). */
export interface Medication {
  id: string;
  user_id: string;
  name: string;
  brand_name: string | null;
  rxcui: string | null;
  strength: string | null;
  dosage_form: string | null;
  imprint: string | null;
  shape: string | null;
  color: string | null;
  ndc: string | null;
  confidence: number | null;
  notes: string | null;
  image_path: string | null;
  label_data: LabelData | null;
  created_at: string;
}

/** Where a finding came from: one drug's FDA label, and the passage relied on. */
export interface FindingSource {
  drug: string;      // whose FDA label this came from
  quote: string;     // passage the model cited
  verified: boolean; // true if the quote was found verbatim in that label text
}

/** A pairwise interaction finding returned by /api/interactions. */
export interface InteractionFinding {
  drug_a: string;
  drug_b: string;
  severity: Severity;    // estimated by the model — FDA labels carry no severity scale
  summary: string;       // plain-language explanation
  sources: FindingSource[];
}

export interface InteractionResult {
  findings: InteractionFinding[];
  checked: string[];    // drugs whose label text was checked
  unchecked: { drug: string; reason: string }[]; // drugs that could NOT be checked
  truncated: string[];  // drugs whose label text was too long to check in full
}
