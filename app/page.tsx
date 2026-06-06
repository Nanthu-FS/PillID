'use client';

import { useRef, useState } from 'react';
import { supabase, PILL_BUCKET } from '@/lib/supabaseClient';
import { Disclaimer } from '@/components/Disclaimer';
import type { Identification } from '@/lib/types';

type Status = 'idle' | 'identifying' | 'done' | 'error';

export default function ScanPage() {
  const [imageData, setImageData] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Identification | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setImageData(null);
    setStatus('idle');
    setError(null);
    setResult(null);
    setSaved(false);
  }

  async function onFile(file: File) {
    const dataUrl = await readAsDataURL(file);
    setImageData(dataUrl);
    setResult(null);
    setSaved(false);
    void identify(dataUrl);
  }

  async function identify(dataUrl: string) {
    setStatus('identifying');
    setError(null);
    try {
      const res = await fetch('/api/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.hint ? `${json.error} — ${json.hint}` : json.error);
      setResult(json as Identification);
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }

  async function addToCabinet() {
    if (!result) return;
    setSaving(true);
    try {
      let image_path: string | null = null;
      if (imageData) {
        const blob = await (await fetch(imageData)).blob();
        const ext = blob.type.split('/')[1] ?? 'jpg';
        const path = `pill-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(PILL_BUCKET)
          .upload(path, blob, { contentType: blob.type, upsert: false });
        if (!upErr) image_path = path;
      }

      const v = result.vision;
      const { error: insErr } = await supabase.from('medications').insert({
        name: result.canonical_name ?? v.name ?? 'Unknown medication',
        brand_name: result.label?.brand_name ?? null,
        rxcui: result.rxcui,
        strength: v.strength,
        dosage_form: v.dosage_form,
        imprint: v.imprint,
        shape: v.shape,
        color: v.color,
        confidence: v.confidence,
        image_path,
        label_data: result.label,
      });
      if (insErr) throw insErr;
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1.5 pt-1">
        <p className="eyebrow">Scan · identify · verify</p>
        <h1 className="text-[1.75rem] font-bold leading-tight">Identify a pill</h1>
        <p className="max-w-prose text-ink-soft">
          Take or upload a clear photo of a single pill. PillID reads it locally with gemma4:12b
          and looks up its FDA label.
        </p>
      </header>

      <Disclaimer />

      {/* Capture / upload zone */}
      {!imageData && (
        <div className="card p-6">
          <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-sage-200 bg-gradient-to-b from-sage-50/70 to-white px-4 py-12 text-center">
            <span
              className="grid h-16 w-16 place-items-center rounded-2xl text-white shadow-[0_10px_22px_-10px_rgba(59,85,68,0.8)]"
              style={{ backgroundImage: 'linear-gradient(145deg,#75A081,#4A6B54)' }}
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                <circle cx="12" cy="13" r="3" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </span>
            <div>
              <p className="font-medium text-ink">Add a pill photo</p>
              <p className="text-sm text-ink-faint">Good lighting and a plain background help.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <button className="btn-primary" onClick={() => fileRef.current?.click()}>
                Choose photo
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
            />
          </div>
        </div>
      )}

      {/* Preview + result */}
      {imageData && (
        <div className="space-y-5">
          <div className="card overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageData} alt="Pill you uploaded" className="max-h-72 w-full object-contain bg-sage-50" />
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <p className="text-sm text-ink-faint">Your photo</p>
              <button className="btn-ghost px-3 py-2 text-sm" onClick={reset}>
                Start over
              </button>
            </div>
          </div>

          {status === 'identifying' && <IdentifyingSkeleton />}

          {status === 'error' && (
            <div role="alert" className="card border-major-ring bg-major-bg p-4 text-major-fg">
              <p className="font-medium">Couldn’t identify this pill</p>
              <p className="mt-1 text-sm">{error}</p>
              <button className="btn-secondary mt-3" onClick={() => imageData && identify(imageData)}>
                Try again
              </button>
            </div>
          )}

          {status === 'done' && result && (
            <ResultCard
              result={result}
              saved={saved}
              saving={saving}
              onSave={addToCabinet}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ResultCard({
  result,
  saved,
  saving,
  onSave,
}: {
  result: Identification;
  saved: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  const v = result.vision;
  const displayName = result.canonical_name ?? v.name ?? 'Not recognized';
  const attrs = [
    ['Imprint', v.imprint],
    ['Shape', v.shape],
    ['Color', v.color],
    ['Strength', v.strength],
    ['Form', v.dosage_form],
  ].filter(([, val]) => val) as [string, string][];

  return (
    <div className="card animate-fade-up p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Best guess</p>
          <h2 className="text-xl font-semibold capitalize">{displayName}</h2>
          {result.label?.brand_name && (
            <p className="text-sm text-ink-soft">Brand: {result.label.brand_name}</p>
          )}
        </div>
        <Confidence value={v.confidence} />
      </div>

      {v.reasoning && <p className="text-sm text-ink-soft italic">“{v.reasoning}”</p>}

      {attrs.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-sage-50 p-3 sm:grid-cols-3">
          {attrs.map(([k, val]) => (
            <div key={k}>
              <dt className="text-xs text-ink-faint">{k}</dt>
              <dd className="text-sm font-medium capitalize text-ink">{val}</dd>
            </div>
          ))}
        </dl>
      )}

      {v.candidates.length > 0 && (
        <div className="text-sm">
          <span className="text-ink-faint">Also possible: </span>
          <span className="text-ink-soft capitalize">{v.candidates.join(', ')}</span>
        </div>
      )}

      {result.label && (
        <div className="space-y-2 border-t border-line pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
            From the FDA label
          </p>
          {result.label.purpose && <LabelRow title="Purpose" body={result.label.purpose} />}
          {result.label.warnings && <LabelRow title="Warnings" body={result.label.warnings} />}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        {saved ? (
          <span className="chip bg-sage-100 text-sage-700">
            <CheckIcon /> Added to cabinet
          </span>
        ) : (
          <button className="btn-primary" onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Add to cabinet'}
          </button>
        )}
        <a href="/cabinet" className="btn-ghost text-sm">
          View cabinet
        </a>
      </div>
    </div>
  );
}

function LabelRow({ title, body }: { title: string; body: string }) {
  return (
    <details className="group rounded-lg bg-cream-200/60 px-3 py-2">
      <summary className="cursor-pointer list-none text-sm font-medium text-ink">
        <span className="mr-1 inline-block transition-transform group-open:rotate-90">›</span>
        {title}
      </summary>
      <p className="mt-1.5 max-h-40 overflow-y-auto text-sm leading-relaxed text-ink-soft">{body}</p>
    </details>
  );
}

function Confidence({ value }: { value: number }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, value)) / 100) * circ;
  const stroke = value >= 70 ? '#5B8266' : value >= 40 ? '#9A4F1E' : '#8F362A';
  const text = value >= 70 ? 'text-sage-700' : value >= 40 ? 'text-moderate-fg' : 'text-major-fg';
  return (
    <div className="shrink-0 text-center" aria-label={`Confidence ${value} percent`}>
      <div className="relative h-[68px] w-[68px]">
        <svg width="68" height="68" viewBox="0 0 68 68" className="-rotate-90">
          <circle cx="34" cy="34" r={r} fill="none" stroke="#E3ECE4" strokeWidth="6" />
          <circle
            cx="34"
            cy="34"
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            className="transition-[stroke-dasharray] duration-700 ease-out"
          />
        </svg>
        <span className={`absolute inset-0 grid place-items-center text-base font-bold tabular-nums ${text}`}>
          {value}%
        </span>
      </div>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">confidence</p>
    </div>
  );
}

function IdentifyingSkeleton() {
  return (
    <div className="card p-5 space-y-3" aria-live="polite" aria-busy="true">
      <p className="text-sm text-ink-soft">Reading the pill with gemma4:12b…</p>
      <div className="skeleton h-6 w-1/2" />
      <div className="skeleton h-16 w-full" />
      <div className="skeleton h-10 w-2/3" />
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
