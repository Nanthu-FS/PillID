import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { modelJSON, modelErrorMessage } from '@/lib/ai';
import { lookupDrug } from '@/lib/lookup';
import { requireUser, enforceDailyLimit } from '@/lib/serverAuth';
import type { DrugLookup, Identification, VisionRead } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

// The client downsizes photos to well under this; anything larger is rejected.
const MAX_BASE64_CHARS = 4_000_000; // ~3 MB of image data
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

const SYSTEM = `You are a pharmacology vision assistant. You examine a photo of a single
pill or tablet and report only what you can actually observe, plus a best guess of the
medication. You are NOT a doctor and must never state a diagnosis or dosing advice.
Be conservative: if the imprint is unreadable, say so and lower your confidence.`;

const PROMPT = `Look at this pill image and report:
- name: most likely medication (generic or brand), or null if unsure
- imprint: any letters/numbers debossed or printed on the pill, or null
- shape: e.g. "round", "oval", "capsule"
- color: e.g. "white", "light blue"
- strength: e.g. "500 mg" if legible, else null
- dosage_form: "tablet", "capsule", etc.
- confidence: 0-100, your confidence in "name"
- reasoning: one short sentence on what drove the guess
- candidates: up to 3 alternative medication names
Only describe what is visible.`;

const visionSchema = z.object({
  name: z.string().nullable(),
  imprint: z.string().nullable(),
  shape: z.string().nullable(),
  color: z.string().nullable(),
  strength: z.string().nullable(),
  dosage_form: z.string().nullable(),
  confidence: z.number(),
  reasoning: z.string().nullable(),
  candidates: z.array(z.string()),
});

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  let body: { image?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const image = typeof body.image === 'string' ? body.image : '';
  if (!image) {
    return NextResponse.json({ error: 'Missing image' }, { status: 400 });
  }
  if (image.length > MAX_BASE64_CHARS) {
    return NextResponse.json({ error: 'Image is too large.' }, { status: 413 });
  }
  const match = DATA_URL.exec(image);
  if (!match || !looksLikeImage(match[2])) {
    return NextResponse.json({ error: 'Image must be a JPEG, PNG or WebP photo.' }, { status: 415 });
  }
  const [, mediaType, base64] = match;

  const limited = await enforceDailyLimit(auth, 'identify');
  if (limited) return limited;

  let vision: VisionRead;
  try {
    const raw = await modelJSON({
      instructions: SYSTEM,
      prompt: PROMPT,
      schema: visionSchema,
      image: { base64, mediaType },
    });
    vision = {
      name: clean(raw.name),
      imprint: clean(raw.imprint),
      shape: clean(raw.shape),
      color: clean(raw.color),
      strength: clean(raw.strength),
      dosage_form: clean(raw.dosage_form),
      confidence: clampPct(raw.confidence),
      reasoning: clean(raw.reasoning),
      candidates: raw.candidates.map((c) => c.trim()).filter(Boolean).slice(0, 3),
    };
  } catch (err) {
    return NextResponse.json({ error: modelErrorMessage(err) }, { status: 502 });
  }

  // Enrich with grounded sources (RxNorm, then openFDA), if we have a name.
  const lookup: DrugLookup = vision.name
    ? await lookupDrug(vision.name)
    : { rxcui: null, canonical_name: null, label: null };

  const result: Identification = { vision, ...lookup };
  return NextResponse.json(result);
}

function clean(s: string | null): string | null {
  const t = s?.trim();
  return t ? t.slice(0, 300) : null;
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Check the file signature so a mislabelled upload is rejected before the model call. */
function looksLikeImage(base64: string): boolean {
  let head: Buffer;
  try {
    head = Buffer.from(base64.slice(0, 24), 'base64');
  } catch {
    return false;
  }
  const hex = head.toString('hex');
  return (
    hex.startsWith('ffd8ff') || // JPEG
    hex.startsWith('89504e470d0a1a0a') || // PNG
    (head.toString('latin1', 0, 4) === 'RIFF' && head.toString('latin1', 8, 12) === 'WEBP')
  );
}
