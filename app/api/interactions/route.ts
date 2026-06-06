import { NextRequest, NextResponse } from 'next/server';
import { ollamaJSON } from '@/lib/ollama';
import { fetchLabel } from '@/lib/openfda';
import type { InteractionFinding, LabelData } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

interface InMed {
  name: string;
  label_data?: LabelData | null;
}

const SYSTEM = `You are a clinical-interaction summarizer. You are given a patient's medication
list and, for some drugs, the "Drug Interactions" / "Warnings" text taken directly from their
official FDA label. Your ONLY job is to report interactions that are SUPPORTED by the provided
label text. Do not invent interactions from general knowledge. If the label text does not
mention another drug in the list, do not report a pair for it. Assign severity conservatively.`;

const buildPrompt = (meds: InMed[]) => {
  const list = meds.map((m, i) => `${i + 1}. ${m.name}`).join('\n');
  const labels = meds
    .filter((m) => m.label_data?.drug_interactions || m.label_data?.warnings)
    .map(
      (m) =>
        `### ${m.name}\nDrug Interactions: ${m.label_data?.drug_interactions ?? 'n/a'}\nWarnings: ${
          m.label_data?.warnings ?? 'n/a'
        }`,
    )
    .join('\n\n');

  return `MEDICATION LIST:\n${list}\n\nFDA LABEL TEXT:\n${labels || '(no label text available)'}\n
Return ONE JSON object: { "findings": Finding[] } where each Finding is:
{
  "drug_a": string,        // a name from the list
  "drug_b": string,        // another name from the list
  "severity": "minor"|"moderate"|"major",
  "summary": string,       // one plain-language sentence a patient can understand
  "source_drug": string    // which drug's label text supports this (drug_a or drug_b)
}
Only include pairs that are BOTH in the medication list AND supported by the label text above.
If none are supported, return { "findings": [] }. No text outside the JSON object.`;
};

export async function POST(req: NextRequest) {
  let body: { meds?: InMed[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const meds = (body.meds ?? []).filter((m) => m?.name);
  if (meds.length < 2) {
    return NextResponse.json({ findings: [], note: 'Add at least two medications to check interactions.' });
  }

  // Ensure each med has label text; fetch any that are missing (in parallel).
  const enriched: InMed[] = await Promise.all(
    meds.map(async (m) => {
      if (m.label_data?.drug_interactions || m.label_data?.warnings) return m;
      const label = await fetchLabel(m.name);
      return { ...m, label_data: label };
    }),
  );

  const haveText = enriched.some(
    (m) => m.label_data?.drug_interactions || m.label_data?.warnings,
  );
  if (!haveText) {
    return NextResponse.json({
      findings: [],
      note: 'No FDA label interaction text was available for these medications, so no grounded check could be run.',
    });
  }

  let parsed: { findings?: InteractionFinding[] };
  try {
    parsed = await ollamaJSON<{ findings?: InteractionFinding[] }>({
      system: SYSTEM,
      prompt: buildPrompt(enriched),
      temperature: 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Interaction check failed: ${msg}` }, { status: 502 });
  }

  const names = new Set(enriched.map((m) => m.name.toLowerCase()));
  const findings = (parsed.findings ?? [])
    .filter(
      (f) =>
        f?.drug_a &&
        f?.drug_b &&
        names.has(f.drug_a.toLowerCase()) &&
        names.has(f.drug_b.toLowerCase()) &&
        ['minor', 'moderate', 'major'].includes(f.severity),
    )
    .slice(0, 50);

  return NextResponse.json({ findings });
}
