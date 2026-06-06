import type { Severity } from '@/lib/types';

const META: Record<Severity, { label: string; cls: string }> = {
  minor: { label: 'Minor', cls: 'bg-minor-bg text-minor-fg ring-1 ring-minor-ring' },
  moderate: { label: 'Moderate', cls: 'bg-moderate-bg text-moderate-fg ring-1 ring-moderate-ring' },
  major: { label: 'Major', cls: 'bg-major-bg text-major-fg ring-1 ring-major-ring' },
};

const RANK: Record<Severity, number> = { major: 3, moderate: 2, minor: 1 };

export function severityRank(s: Severity) {
  return RANK[s];
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const m = META[severity];
  return (
    <span className={`chip ${m.cls}`}>
      {/* shape differs per level so meaning isn't color-only (skill: color-not-only) */}
      <SeverityGlyph severity={severity} />
      {m.label}
    </span>
  );
}

function SeverityGlyph({ severity }: { severity: Severity }) {
  if (severity === 'major') {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M10.3 4.3 3.5 16a2 2 0 0 0 1.7 3h13.6a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="2" />
        <path d="M12 9v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (severity === 'moderate') {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
        <path d="M12 8v4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
      <path d="M9.5 12.2l1.7 1.7 3.3-3.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
