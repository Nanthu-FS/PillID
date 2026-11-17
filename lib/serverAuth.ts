// Server-side auth + usage limits for the API routes. Every route requires a
// signed-in Supabase user; the database client is scoped to that user, so RLS
// applies to everything the route reads or writes.

import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface AuthedRequest {
  userId: string;
  db: SupabaseClient;
}

export async function requireUser(req: NextRequest): Promise<AuthedRequest | NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Server is missing its Supabase configuration.' }, { status: 500 });
  }

  const header = req.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  }

  const db = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) {
    return NextResponse.json({ error: 'Your session has expired. Please sign in again.' }, { status: 401 });
  }
  return { userId: data.user.id, db };
}

export type UsageRoute = 'identify' | 'interactions';

const DEFAULT_DAILY_LIMIT: Record<UsageRoute, number> = { identify: 25, interactions: 15 };

function dailyLimit(route: UsageRoute): number {
  const raw = process.env[`${route.toUpperCase()}_DAILY_LIMIT`];
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_DAILY_LIMIT[route];
}

/**
 * Per-user rolling 24h limit on the routes that call the paid model.
 * Returns a response to send if the caller is over the limit (or the check
 * itself failed — these calls cost money, so the check fails closed).
 */
export async function enforceDailyLimit(
  { db }: AuthedRequest,
  route: UsageRoute,
): Promise<NextResponse | null> {
  const limit = dailyLimit(route);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count, error } = await db
    .from('api_usage')
    .select('id', { count: 'exact', head: true })
    .eq('route', route)
    .gte('created_at', since);
  if (error || count === null) {
    console.error('[PillID] usage check failed:', error);
    return NextResponse.json({ error: 'Could not check your usage limit. Please try again.' }, { status: 503 });
  }
  if (count >= limit) {
    return NextResponse.json(
      { error: `Daily limit reached (${limit} per 24 hours). Please try again later.` },
      { status: 429 },
    );
  }

  const { error: insErr } = await db.from('api_usage').insert({ route });
  if (insErr) {
    console.error('[PillID] usage insert failed:', insErr);
    return NextResponse.json({ error: 'Could not record usage. Please try again.' }, { status: 503 });
  }
  return null;
}
