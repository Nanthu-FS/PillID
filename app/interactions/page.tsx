'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { Disclaimer } from '@/components/Disclaimer';
import { SeverityBadge, severityRank } from '@/components/Severity';
import type { InteractionFinding, Medication } from '@/lib/types';

type Status = 'loading' | 'ready' | 'checking' | 'done' | 'error';

export default function InteractionsPage() {
  const [meds, setMeds] = useState<Medication[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [findings, setFindings] = useState<InteractionFinding[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        setError(error.message);
        setStatus('error');
      } else {
        setMeds((data as Medication[]) ?? []);
        setStatus('ready');
      }
    })();
  }, []);

  async function check() {
    setStatus('checking');
    setError(null);
    setNote(null);
    try {
      const res = await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meds: meds.map((m) => ({ name: m.name, label_data: m.label_data })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const sorted = (json.findings as InteractionFinding[]).sort(
        (a, b) => severityRank(b.severity) - severityRank(a.severity),
      );
      setFindings(sorted);
      setNote(json.note ?? null);
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1 pt-1">
        <h1 className="text-2xl font-semibold">Interaction check</h1>
        <p className="text-ink-soft">
          Cross-checks the medications in your cabinet using their FDA label text.
        </p>
      </header>

      <Disclaimer />

      {status === 'loading' && <div className="skeleton h-24 w-full" />}

      {meds.length < 2 && status !== 'loading' && (
        <div className="card p-8 text-center">
          <p className="font-medium text-ink">Add at least two medications</p>
          <p className="mt-1 text-sm text-ink-faint">
            Interaction checks need two or more saved medications.
          </p>
          <Link href="/" className="btn-primary mt-4">
            Scan a pill
          </Link>
        </div>
      )}

      {meds.length >= 2 && (
        <div className="card p-5 space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
              Checking {meds.length} medications
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {meds.map((m) => (
                <li key={m.id} className="chip bg-sage-50 capitalize text-sage-800">
                  {m.name}
                </li>
              ))}
            </ul>
          </div>

          {status !== 'done' && (
            <button className="btn-primary" onClick={check} disabled={status === 'checking'}>
              {status === 'checking' ? 'Checking with gemma4:12b…' : 'Run interaction check'}
            </button>
          )}

          {status === 'checking' && (
            <div className="space-y-2" aria-live="polite" aria-busy="true">
              <div className="skeleton h-14 w-full" />
              <div className="skeleton h-14 w-full" />
            </div>
          )}
        </div>
      )}

      {status === 'error' && (
        <div role="alert" className="card border-major-ring bg-major-bg p-4 text-major-fg">
          <p className="font-medium">Interaction check failed</p>
          <p className="mt-1 text-sm">{error}</p>
          <button className="btn-secondary mt-3" onClick={check}>
            Try again
          </button>
        </div>
      )}

      {status === 'done' && findings && (
        <Results findings={findings} note={note} onRecheck={check} />
      )}
    </div>
  );
}

function Results({
  findings,
  note,
  onRecheck,
}: {
  findings: InteractionFinding[];
  note: string | null;
  onRecheck: () => void;
}) {
  return (
    <section className="space-y-3 animate-fade-up">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {findings.length === 0
            ? 'No interactions found'
            : `${findings.length} potential interaction${findings.length === 1 ? '' : 's'}`}
        </h2>
        <button className="btn-ghost px-3 py-2 text-sm" onClick={onRecheck}>
          Re-check
        </button>
      </div>

      {findings.length === 0 && (
        <div className="card border-sage-200 bg-sage-50/60 p-5 text-sage-800">
          <p className="font-medium">Nothing flagged in the FDA label text.</p>
          <p className="mt-1 text-sm">
            {note ??
              'This is not a guarantee of safety — labels don’t list every interaction. Always confirm with a pharmacist.'}
          </p>
        </div>
      )}

      {findings.map((f, i) => (
        <article key={i} className="card p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <p className="font-heading font-semibold capitalize text-ink">
              {f.drug_a} <span className="text-ink-faint">+</span> {f.drug_b}
            </p>
            <SeverityBadge severity={f.severity} />
          </div>
          <p className="text-sm leading-relaxed text-ink-soft">{f.summary}</p>
          <p className="text-xs text-ink-faint">
            Grounded in the FDA label for <span className="capitalize">{f.source_drug}</span>.
          </p>
        </article>
      ))}
    </section>
  );
}
