import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { modelJSON } from '@/lib/ai';
import { fetchLabel, interactionText } from '@/lib/openfda';
import { requireUser, enforceDailyLimit } from '@/lib/serverAuth';
import type {
  FindingSource,
  InteractionFinding,
  InteractionResult,
  LabelData,
  Severity,
} from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_MEDS = 12;
// Per-label budget. Each label is checked in its own model call, so one long
// label can never push another out of the context window.
const MAX_LABEL_CHARS = 40_000;

const SYSTEM = `You are a clinical-interaction summarizer. You are given the interaction and
warning text taken directly from ONE drug's official FDA label, and a list of the other
medications the patient takes. Report an interaction only when that label text states it.
You may use general pharmacology knowledge solely to recognise that a listed medication is
the drug, a synonym, or a member of a drug class that the label text names (for example,
ibuprofen is an NSAID). The interaction itself must come from the label text — never from
general knowledge. For every finding, quote the supporting passage word for word.`;

const findingsSchema = z.object({
  findings: z.array(
    z.object({
      other_drug: z.string(),
      severity: z.enum(['minor', 'moderate', 'major']),
      summary: z.string(),
      quote: z.string(),
    }),
  ),
});

const buildPrompt = (drug: string, text: string, others: string[]) =>
  `FDA LABEL TEXT FOR: ${drug}\n"""\n${text}\n"""\n
OTHER MEDICATIONS THE PATIENT TAKES:\n${others.map((o) => `- ${o}`).join('\n')}\n
List each interaction between ${drug} and one of the other medications that the label text
above supports. For each one give:
- other_drug: the name exactly as written in the list above
- severity: "minor", "moderate" or "major" — your conservative estimate
- summary: one plain-language sentence a patient can understand
- quote: the sentence(s) from the label text that support it, copied word for word
If the label text supports none, return an empty list.`;

interface Med {
  name: string;
  text: string;
}

const RANK: Record<Severity, number> = { minor: 1, moderate: 2, major: 3 };
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  // Read the cabinet server-side (RLS scopes it to this user) rather than
  // trusting label text sent by the browser.
  const { data, error } = await auth.db
    .from('medications')
    .select('name, label_data')
    .order('created_at', { ascending: false });
  if (error) {
    return NextResponse.json({ error: 'Could not load your cabinet.' }, { status: 500 });
  }

  // One entry per distinct drug name.
  const byName = new Map<string, { name: string; label_data: LabelData | null }>();
  for (const row of data ?? []) {
    const key = String(row.name ?? '').trim().toLowerCase();
    if (key && !byName.has(key)) byName.set(key, { name: String(row.name).trim(), label_data: row.label_data });
  }
  const rows = [...byName.values()];

  const result: InteractionResult = { findings: [], checked: [], unchecked: [], truncated: [] };
  if (rows.length < 2) return NextResponse.json(result);

  for (const extra of rows.slice(MAX_MEDS)) {
    result.unchecked.push({ drug: extra.name, reason: `only the ${MAX_MEDS} most recent medications are checked` });
  }
  const selected = rows.slice(0, MAX_MEDS);

  const limited = await enforceDailyLimit(auth, 'interactions');
  if (limited) return limited;

  // Make sure each drug has label text; fetch any that are missing.
  const meds: Med[] = await Promise.all(
    selected.map(async (m) => {
      let text = interactionText(m.label_data);
      if (!text) text = interactionText(await fetchLabel(m.name));
      return { name: m.name, text };
    }),
  );

  const names = meds.map((m) => m.name);
  const sourcesByPair = new Map<string, InteractionFinding>();

  await Promise.all(
    meds.map(async (med) => {
      if (!med.text) {
        result.unchecked.push({ drug: med.name, reason: 'no FDA label text was found' });
        return;
      }
      let text = med.text;
      if (text.length > MAX_LABEL_CHARS) {
        text = text.slice(0, MAX_LABEL_CHARS);
        result.truncated.push(med.name);
      }
      const others = names.filter((n) => n !== med.name);

      let parsed: z.infer<typeof findingsSchema>;
      try {
        parsed = await modelJSON({
          instructions: SYSTEM,
          prompt: buildPrompt(med.name, text, others),
          schema: findingsSchema,
          temperature: 0,
        });
      } catch (err) {
        console.error(`[PillID] interaction check failed for ${med.name}:`, err);
        result.unchecked.push({ drug: med.name, reason: 'the check did not complete' });
        return;
      }
      result.checked.push(med.name);

      const labelSquashed = squash(text);
      for (const f of parsed.findings) {
        const other = others.find((o) => o.toLowerCase() === f.other_drug.trim().toLowerCase());
        if (!other || !f.summary.trim()) continue; // not a drug in this cabinet

        const quote = f.quote.trim().slice(0, 600);
        const q = squash(quote);
        const source: FindingSource = {
          drug: med.name,
          quote,
          // Verbatim check, ignoring case/punctuation/whitespace differences.
          verified: q.length >= 20 && labelSquashed.includes(q),
        };

        const [a, b] = [med.name, other].sort((x, y) => x.localeCompare(y));
        const key = `${a.toLowerCase()}|${b.toLowerCase()}`;
        const existing = sourcesByPair.get(key);
        if (!existing) {
          sourcesByPair.set(key, {
            drug_a: a,
            drug_b: b,
            severity: f.severity,
            summary: f.summary.trim().slice(0, 500),
            sources: [source],
          });
        } else {
          // Same pair reported from both labels: keep the more serious reading.
          if (RANK[f.severity] > RANK[existing.severity]) {
            existing.severity = f.severity;
            existing.summary = f.summary.trim().slice(0, 500);
          }
          if (!existing.sources.some((s) => s.drug === med.name)) existing.sources.push(source);
        }
      }
    }),
  );

  result.findings = [...sourcesByPair.values()].sort((x, y) => RANK[y.severity] - RANK[x.severity]);
  return NextResponse.json(result);
}
