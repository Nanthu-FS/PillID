'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, PILL_BUCKET } from '@/lib/supabaseClient';
import type { Medication } from '@/lib/types';

export default function CabinetPage() {
  const [meds, setMeds] = useState<Medication[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setMeds(data as Medication[]);
  }

  useEffect(() => {
    void load();
  }, []);

  async function remove(id: string, image_path: string | null) {
    if (!confirm('Remove this medication from your cabinet?')) return;
    setMeds((prev) => prev?.filter((m) => m.id !== id) ?? null); // optimistic
    await supabase.from('medications').delete().eq('id', id);
    if (image_path) await supabase.storage.from(PILL_BUCKET).remove([image_path]);
  }

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3 pt-1">
        <div>
          <h1 className="text-2xl font-semibold">Medicine cabinet</h1>
          <p className="text-ink-soft">
            {meds ? `${meds.length} medication${meds.length === 1 ? '' : 's'} saved` : 'Loading…'}
          </p>
        </div>
        {meds && meds.length >= 2 && (
          <Link href="/interactions" className="btn-secondary text-sm">
            Check interactions
          </Link>
        )}
      </header>

      {error && (
        <div role="alert" className="card border-major-ring bg-major-bg p-4 text-major-fg">
          {error}
        </div>
      )}

      {meds === null && <CabinetSkeleton />}

      {meds && meds.length === 0 && (
        <div className="card p-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-sage-100 text-sage-600">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M12 9v6M9 12h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          <p className="mt-3 font-medium text-ink">Your cabinet is empty</p>
          <p className="mt-1 text-sm text-ink-faint">Scan a pill to add your first medication.</p>
          <Link href="/" className="btn-primary mt-4">
            Scan a pill
          </Link>
        </div>
      )}

      {meds && meds.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {meds.map((m) => (
            <li key={m.id}>
              <MedCard med={m} onRemove={() => remove(m.id, m.image_path)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MedCard({ med, onRemove }: { med: Medication; onRemove: () => void }) {
  const imgUrl = med.image_path
    ? supabase.storage.from(PILL_BUCKET).getPublicUrl(med.image_path).data.publicUrl
    : null;
  const facts = [med.strength, med.dosage_form, med.color, med.shape].filter(Boolean).join(' · ');

  return (
    <div className="card card-interactive animate-fade-up flex gap-3 p-3">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-sage-50">
        {imgUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgUrl} alt={`Photo of ${med.name}`} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-sage-300">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="2.5" y="8" width="19" height="8" rx="4" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h2 className="truncate font-heading font-semibold capitalize text-ink">{med.name}</h2>
          <button
            onClick={onRemove}
            aria-label={`Remove ${med.name}`}
            className="shrink-0 rounded-lg p-1.5 text-ink-faint hover:bg-major-bg hover:text-major-fg focus-visible:ring-4 focus-visible:ring-sage-300"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        {med.brand_name && <p className="truncate text-sm text-ink-soft">{med.brand_name}</p>}
        {facts && <p className="mt-0.5 truncate text-xs capitalize text-ink-faint">{facts}</p>}
        {med.imprint && (
          <p className="mt-1 inline-block rounded-md bg-cream-200 px-2 py-0.5 text-xs font-medium text-ink-soft">
            Imprint: {med.imprint}
          </p>
        )}
      </div>
    </div>
  );
}

function CabinetSkeleton() {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="card flex gap-3 p-3">
          <div className="skeleton h-20 w-20 shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <div className="skeleton h-5 w-2/3" />
            <div className="skeleton h-3 w-1/2" />
            <div className="skeleton h-3 w-1/3" />
          </div>
        </li>
      ))}
    </ul>
  );
}
