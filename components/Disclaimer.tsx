/**
 * Safety disclaimer. This app is informational only — it must be visually
 * prominent on every screen that shows identification or interaction results.
 */
export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <div
      role="note"
      className={`flex items-start gap-2.5 rounded-xl border border-minor-ring bg-minor-bg ${
        compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm'
      } text-minor-fg`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mt-0.5 shrink-0">
        <path d="M12 9v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="16.5" r="1.1" fill="currentColor" />
        <path d="M10.3 4.3 3.5 16a2 2 0 0 0 1.7 3h13.6a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
      <p>
        <strong className="font-semibold">Not medical advice.</strong> PillID can be wrong.
        Identification is a best guess from a photo — always confirm with the original packaging,
        a pharmacist, or your doctor before taking or changing any medication.
      </p>
    </div>
  );
}
