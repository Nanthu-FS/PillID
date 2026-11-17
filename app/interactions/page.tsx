'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, postJSON } from '@/lib/supabaseClient';
import { Disclaimer } from '@/components/Disclaimer';
import { SeverityBadge } from '@/components/Severity';
import type { InteractionResult, Medication } from '@/lib/types';

type Status = 'loading' | 'ready' | 'checking' | 'done' | 'error';

export default function InteractionsPage() {
  const [meds, setMeds] = useState<Medication[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [result, setResult] = useState<InteractionResult | null>(null);
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

  // The server reads the cabinet itself, so nothing needs to be sent.
  async function check() {
    setStatus('checking');
    setError(null);
    try {
      setResult(await postJSON<InteractionResult>('/api/interactions'));
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }

  const names = [...new Set(meds.map((m) => m.name.trim().toLowerCase()))];

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

      {names.length < 2 && status !== 'loading' && status !== 'error' && (
        <div className="card p-8 text-center">
          <p className="font-medium text-ink">Add at least two medications</p>
          <p className="mt-1 text-sm text-ink-faint">
            Interaction checks need two or more different saved medications.
          </p>
          <Link href="/" className="btn-primary mt-4">
            Scan a pill
          </Link>
        </div>
      )}

      {names.length >= 2 && (
        <div className="card p-5 space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
              Checking {names.length} medications
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {names.map((n) => (
                <li key={n} className="chip bg-sage-50 capitalize text-sage-800">
                  {n}
                </li>
              ))}
            </ul>
          </div>

          {status !== 'done' && (
            <button className="btn-primary" onClick={check} disabled={status === 'checking'}>
              {status === 'checking' ? 'Checking the labels…' : 'Run interaction check'}
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
          {names.length >= 2 && (
            <button className="btn-secondary mt-3" onClick={check}>
              Try again
            </button>
          )}
        </div>
      )}

      {status === 'done' && result && <Results result={result} onRecheck={check} />}
    </div>
  );
}

function Results({ result, onRecheck }: { result: InteractionResult; onRecheck: () => void }) {
  const { findings, checked, unchecked, truncated } = result;
  // "Nothing flagged" is only a fair summary if every label was actually read in full.
  const complete = unchecked.length === 0 && truncated.length === 0;

  return (
    <section className="space-y-3 animate-fade-up">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {findings.length > 0
            ? `${findings.length} potential interaction${findings.length === 1 ? '' : 's'}`
            : complete
              ? 'Nothing flagged'
              : 'Check incomplete'}
        </h2>
        <button className="btn-ghost px-3 py-2 text-sm" onClick={onRecheck}>
          Re-check
        </button>
      </div>

      {!complete && (
        <div role="alert" className="card border-moderate-ring bg-moderate-bg p-4 text-moderate-fg">
          <p className="font-medium">Some medications could not be fully checked</p>
          <ul className="mt-1.5 space-y-1 text-sm">
            {unchecked.map((u) => (
              <li key={u.drug}>
                <span className="font-medium capitalize">{u.drug}</span> — not checked: {u.reason}.
              </li>
            ))}
            {truncated.map((d) => (
              <li key={d}>
                <span className="font-medium capitalize">{d}</span> — its label was too long, so only
                the first part was checked.
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm">
            Interactions involving these may be missing. Ask a pharmacist about them.
          </p>
        </div>
      )}

      {findings.length === 0 && checked.length > 0 && (
        <div className="card border-sage-200 bg-sage-50/60 p-5 text-sage-800">
          <p className="font-medium">
            Nothing flagged in the FDA label text for{' '}
            <span className="capitalize">{checked.join(', ')}</span>.
          </p>
          <p className="mt-1 text-sm">
            This is not a guarantee of safety — labels don’t list every interaction. Always confirm
            with a pharmacist.
          </p>
        </div>
      )}

      {findings.map((f) => (
        <article key={`${f.drug_a}|${f.drug_b}`} className="card p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <p className="font-heading font-semibold capitalize text-ink">
              {f.drug_a} <span className="text-ink-faint">+</span> {f.drug_b}
            </p>
            <SeverityBadge severity={f.severity} />
          </div>
          <p className="text-sm leading-relaxed text-ink-soft">{f.summary}</p>
          {f.sources.map((s) => (
            <figure key={s.drug} className="rounded-lg bg-cream-200/60 px-3 py-2">
              <blockquote className="text-sm leading-relaxed text-ink-soft">“{s.quote}”</blockquote>
              <figcaption className="mt-1 text-xs text-ink-faint">
                {s.verified ? (
                  <>
                    Quoted from the FDA label for <span className="capitalize">{s.drug}</span>.
                  </>
                ) : (
                  <>
                    Attributed to the FDA label for <span className="capitalize">{s.drug}</span>, but
                    this wording could not be matched to the label — treat with extra caution.
                  </>
                )}
              </figcaption>
            </figure>
          ))}
        </article>
      ))}

      {findings.length > 0 && (
        <p className="text-xs text-ink-faint">
          Severity levels are an AI estimate. FDA labels describe interactions but do not grade them.
        </p>
      )}
    </section>
  );
}
