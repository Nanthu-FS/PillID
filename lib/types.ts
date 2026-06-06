// Shared types for PillID.

export type Severity = 'minor' | 'moderate' | 'major';

/** Raw vision read from gemma4:12b before enrichment. */
export interface VisionRead {
  name: string | null;        // best-guess generic or brand name
  imprint: string | null;     // imprint / debossed code
  shape: string | null;
  color: string | null;
  strength: string | null;    // e.g. "500 mg"
  dosage_form: string | null; // tablet, capsule, ...
  confidence: number;         // 0-100
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
  source: 'openfda';
}

/** Full identification result returned by /api/identify. */
export interface Identification {
  vision: VisionRead;
  rxcui: string | null;
  canonical_name: string | null;
  label: LabelData | null;
}

/** A saved medication row (mirrors the Supabase `medications` table). */
export interface Medication {
  id: string;
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

/** A pairwise interaction finding returned by /api/interactions. */
export interface InteractionFinding {
  drug_a: string;
  drug_b: string;
  severity: Severity;
  summary: string;       // plain-language explanation
  source_drug: string;   // which drug's FDA label this was grounded in
}
