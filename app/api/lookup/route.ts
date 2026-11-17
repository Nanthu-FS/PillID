import { NextRequest, NextResponse } from 'next/server';
import { lookupDrug } from '@/lib/lookup';
import { requireUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** Grounded facts for a name the user typed or picked (no model call). */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  let body: { name?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 120) {
    return NextResponse.json({ error: 'Enter a medication name.' }, { status: 400 });
  }
  return NextResponse.json(await lookupDrug(name));
}
