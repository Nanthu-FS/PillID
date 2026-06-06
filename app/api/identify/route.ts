import { NextRequest, NextResponse } from 'next/server';
import { ollamaJSON } from '@/lib/ollama';
import { normalizeDrug } from '@/lib/rxnorm';
import { fetchLabel } from '@/lib/openfda';
import type { Identification, VisionRead } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

const SYSTEM = `You are a pharmacology vision assistant. You examine a photo of a single
pill or tablet and report only what you can actually observe, plus a calibrated best guess
of the medication. You are NOT a doctor and must never state a diagnosis or dosing advice.
Be conservative: if the imprint is unreadable, say so and lower your confidence.`;

const PROMPT = `Look at this pill image. Return ONE JSON object with EXACTLY these keys:
{
  "name": string|null,          // most likely medication (generic or brand), or null if unsure
  "imprint": string|null,       // any letters/numbers debossed or printed on the pill
  "shape": string|null,         // e.g. "round", "oval", "capsule"
  "color": string|null,         // e.g. "white", "light blue"
  "strength": string|null,      // e.g. "500 mg", if legible/known, else null
  "dosage_form": string|null,   // "tablet", "capsule", etc.
  "confidence": number,         // 0-100, your calibrated confidence in "name"
  "reasoning": string|null,     // one short sentence on what drove the guess
  "candidates": string[]        // up to 3 alternative medication names
}
Only describe what is visible. Do not output any text outside the JSON object.`;

export async function POST(req: NextRequest) {
  let body: { image?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const image = body.image;
  if (!image) {
    return NextResponse.json({ error: 'Missing image' }, { status: 400 });
  }

  // Strip a data-URL prefix if present.
  const base64 = image.includes(',') ? image.split(',')[1] : image;

  let vision: VisionRead;
  try {
    vision = await ollamaJSON<VisionRead>({
      system: SYSTEM,
      prompt: PROMPT,
      images: [base64],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const hint = /fetch failed|ECONNREFUSED/i.test(msg)
      ? 'Is Ollama running and is gemma4:12b pulled? (ollama pull gemma4:12b)'
      : undefined;
    return NextResponse.json({ error: `Vision model failed: ${msg}`, hint }, { status: 502 });
  }

  // Normalize / sanity-check the shape of the model output.
  vision = {
    name: vision.name ?? null,
    imprint: vision.imprint ?? null,
    shape: vision.shape ?? null,
    color: vision.color ?? null,
    strength: vision.strength ?? null,
    dosage_form: vision.dosage_form ?? null,
    confidence: clampPct(vision.confidence),
    reasoning: vision.reasoning ?? null,
    candidates: Array.isArray(vision.candidates) ? vision.candidates.slice(0, 3) : [],
  };

  // Enrich with grounded sources (RxNorm + openFDA), if we have a name.
  let rxcui: string | null = null;
  let canonical_name: string | null = null;
  let label = null;

  if (vision.name) {
    const [rx, lbl] = await Promise.all([
      normalizeDrug(vision.name),
      fetchLabel(vision.name),
    ]);
    rxcui = rx.rxcui;
    canonical_name = rx.name;
    label = lbl;
  }

  const result: Identification = { vision, rxcui, canonical_name, label };
  return NextResponse.json(result);
}

function clampPct(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}
