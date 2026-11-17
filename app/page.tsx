'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { supabase, PILL_BUCKET, postJSON } from '@/lib/supabaseClient';
import { compressImage } from '@/lib/image';
import { useUserId } from '@/components/AuthGate';
import { Disclaimer } from '@/components/Disclaimer';
import type { DrugLookup, Identification } from '@/lib/types';

type Status = 'idle' | 'identifying' | 'done' | 'error';

export default function ScanPage() {
  const userId = useUserId();
  const [imageData, setImageData] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Identification | null>(null);
  // True once the user has replaced the model's guess with a name of their own.
  const [corrected, setCorrected] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setImageData(null);
    setStatus('idle');
    setError(null);
    setResult(null);
    setCorrected(false);
    setSaved(false);
    setSaveError(null);
  }

  async function onFile(file: File) {
    reset();
    try {
      const dataUrl = await compressImage(file);
      setImageData(dataUrl);
      void identify(dataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function identify(dataUrl: string) {
    setStatus('identifying');
    setError(null);
    setCorrected(false);
    try {
      setResult(await postJSON<Identification>('/api/identify', { image: dataUrl }));
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }

  /** Replace the model's guess with a name the user typed or picked. */
  async function correctName(name: string) {
    if (!result) return;
    setLookingUp(true);
    setSaveError(null);
    try {
      const lookup = await postJSON<DrugLookup>('/api/lookup', { name });
      setResult({ ...result, ...lookup, canonical_name: lookup.canonical_name ?? name });
      setCorrected(true);
      setSaved(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setLookingUp(false);
    }
  }

  async function addToCabinet() {
    if (!result) return;
    const name = result.canonical_name ?? result.vision.name;
    if (!name) return;
    setSaving(true);
    setSaveError(null);

    // Photos live in a private bucket, under a folder only this user can read.
    let image_path: string | null = null;
    try {
      if (imageData) {
        const blob = await (await fetch(imageData)).blob();
        const path = `${userId}/${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await supabase.storage
          .from(PILL_BUCKET)
          .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
        if (upErr) throw upErr;
        image_path = path;
      }

      const v = result.vision;
      const { error: insErr } = await supabase.from('medications').insert({
        name,
        brand_name: result.label?.brand_name ?? null,
        rxcui: result.rxcui,
        strength: v.strength,
        dosage_form: v.dosage_form,
        imprint: v.imprint,
        shape: v.shape,
        color: v.color,
        // The model's confidence was about its own guess, not a corrected name.
        confidence: corrected ? null : v.confidence,
        notes: corrected ? 'Name entered by user' : null,
        image_path,
        label_data: result.label,
      });
      if (insErr) throw insErr;
      setSaved(true);
    } catch (e) {
      // Don't leave an orphaned photo behind if the row wasn't saved.
      if (image_path) await supabase.storage.from(PILL_BUCKET).remove([image_path]);
      setSaveError(e instanceof Error ? e.message : 'Could not save this medication.');
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
          Take or upload a clear photo of a single pill. PillID suggests what it might be and
          looks up the FDA label — you confirm it against the packaging.
        </p>
      </header>

      <Disclaimer />

      {error && !imageData && (
        <div role="alert" className="card border-major-ring bg-major-bg p-4 text-major-fg">
          {error}
        </div>
      )}

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
              <button className="btn-primary" onClick={() => cameraRef.current?.click()}>
                Take photo
              </button>
              <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
                Choose from library
              </button>
            </div>
            <p className="max-w-sm text-xs text-ink-faint">
              Your photo is sent to a hosted AI model to be read, and is stored in your private
              cabinet only if you save it.
            </p>
            {[cameraRef, fileRef].map((ref, i) => (
              <input
                key={i}
                ref={ref}
                type="file"
                accept="image/*"
                capture={i === 0 ? 'environment' : undefined}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void onFile(f);
                }}
              />
            ))}
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
              corrected={corrected}
              lookingUp={lookingUp}
              saved={saved}
              saving={saving}
              saveError={saveError}
              onCorrect={correctName}
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
  corrected,
  lookingUp,
  saved,
  saving,
  saveError,
  onCorrect,
  onSave,
}: {
  result: Identification;
  corrected: boolean;
  lookingUp: boolean;
  saved: boolean;
  saving: boolean;
  saveError: string | null;
  onCorrect: (name: string) => void;
  onSave: () => void;
}) {
  const v = result.vision;
  const name = result.canonical_name ?? v.name;
  const [draft, setDraft] = useState('');
  const attrs = [
    ['Imprint', v.imprint],
    ['Shape', v.shape],
    ['Color', v.color],
    ['Strength', v.strength],
    ['Form', v.dosage_form],
  ].filter(([, val]) => val) as [string, string][];
  const warnings = [
    ['Boxed warning', result.label?.boxed_warning],
    ['Warnings', result.label?.warnings],
    ['Warnings and precautions', result.label?.warnings_and_cautions],
  ].filter(([, val]) => val) as [string, string][];

  return (
    <div className="card animate-fade-up p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
            {corrected ? 'Name you entered' : 'Best guess — not confirmed'}
          </p>
          <h2 className="text-xl font-semibold capitalize">{name ?? 'Not recognized'}</h2>
          {result.label?.brand_name && (
            <p className="text-sm text-ink-soft">Brand: {result.label.brand_name}</p>
          )}
        </div>
        {!corrected && name && <Confidence value={v.confidence} />}
      </div>

      {!corrected && v.reasoning && <p className="text-sm text-ink-soft italic">“{v.reasoning}”</p>}

      {attrs.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-sage-50 p-3 sm:grid-cols-3">
          {attrs.map(([k, val]) => (
            <div key={k}>
              <dt className="text-xs text-ink-faint">{k} (as read from photo)</dt>
              <dd className="text-sm font-medium capitalize text-ink">{val}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* Let the user overrule the guess: pick an alternative or type the name. */}
      <div className="space-y-2 rounded-xl border border-line p-3">
        <p className="text-sm font-medium text-ink">
          {name ? 'Not right? Correct the name' : 'Enter the name from the packaging'}
        </p>
        {!corrected && v.candidates.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-faint">Also possible:</span>
            {v.candidates.map((c) => (
              <button
                key={c}
                className="chip bg-sage-50 capitalize text-sage-800 hover:bg-sage-100"
                disabled={lookingUp}
                onClick={() => onCorrect(c)}
              >
                {c}
              </button>
            ))}
          </div>
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) onCorrect(draft.trim());
          }}
        >
          <input
            aria-label="Medication name"
            className="input"
            placeholder="e.g. ibuprofen"
            maxLength={120}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" className="btn-secondary shrink-0" disabled={lookingUp || !draft.trim()}>
            {lookingUp ? 'Looking up…' : 'Look up'}
          </button>
        </form>
      </div>

      {name && (
        <div className="space-y-2 border-t border-line pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
            From the FDA label for {result.label?.generic_name ?? name}
          </p>
          {result.label ? (
            <>
              {result.label.purpose && <LabelRow title="Purpose" body={result.label.purpose} />}
              {warnings.map(([title, body]) => (
                <LabelRow key={title} title={title} body={body} />
              ))}
            </>
          ) : (
            <p className="text-sm text-ink-soft">
              No FDA label was found for this name, so no warnings can be shown.
            </p>
          )}
        </div>
      )}

      {saveError && (
        <p role="alert" className="text-sm text-major-fg">
          {saveError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        {saved ? (
          <span className="chip bg-sage-100 text-sage-700">
            <CheckIcon /> Added to cabinet
          </span>
        ) : (
          <button className="btn-primary" onClick={onSave} disabled={saving || lookingUp || !name}>
            {saving ? 'Saving…' : 'It matches the packaging — add to cabinet'}
          </button>
        )}
        <Link href="/cabinet" className="btn-ghost text-sm">
          View cabinet
        </Link>
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
      <p className="mt-1.5 max-h-40 overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-ink-soft">{body}</p>
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
    <div className="shrink-0 text-center" aria-label={`The model rates its own guess at ${value} percent`}>
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
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">model’s guess</p>
    </div>
  );
}

function IdentifyingSkeleton() {
  return (
    <div className="card p-5 space-y-3" aria-live="polite" aria-busy="true">
      <p className="text-sm text-ink-soft">Reading the pill…</p>
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
