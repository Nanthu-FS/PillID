'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', label: 'Scan', icon: CameraIcon },
  { href: '/cabinet', label: 'Cabinet', icon: GridIcon },
  { href: '/interactions', label: 'Interactions', icon: ShieldIcon },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <>
      {/* Top brand bar */}
      <header className="sticky top-0 z-30 border-b border-line bg-cream/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-4 py-3 sm:px-6">
          <span
            className="grid h-10 w-10 place-items-center rounded-2xl text-white shadow-[0_6px_14px_-6px_rgba(59,85,68,0.7)]"
            style={{ backgroundImage: 'linear-gradient(145deg,#75A081,#4A6B54)' }}
          >
            <PillMark />
          </span>
          <div className="leading-tight">
            <p className="font-heading text-lg font-semibold text-ink">PillID</p>
            <p className="text-xs text-ink-faint">your calm medicine cabinet</p>
          </div>
        </div>
      </header>

      {/* Bottom nav — ≤5 items, icon + label, active state (skill: bottom-nav-limit) */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur"
      >
        <ul className="mx-auto flex max-w-3xl items-stretch justify-around px-2 py-1.5">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-xs font-medium transition-colors ${
                    active ? 'text-sage-700' : 'text-ink-faint hover:text-sage-600'
                  }`}
                >
                  {active && (
                    <span aria-hidden className="absolute -top-px h-1 w-8 rounded-full bg-sage-500" />
                  )}
                  <Icon active={active} />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

function PillMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2.5" y="8" width="19" height="8" rx="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v8" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

interface IconProps {
  active?: boolean;
}
const stroke = (active?: boolean) => (active ? 2.2 : 1.8);

function CameraIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth={stroke(active)}
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="3" stroke="currentColor" strokeWidth={stroke(active)} />
    </svg>
  );
}

function GridIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.6" stroke="currentColor" strokeWidth={stroke(active)} />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" stroke="currentColor" strokeWidth={stroke(active)} />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" stroke="currentColor" strokeWidth={stroke(active)} />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" stroke="currentColor" strokeWidth={stroke(active)} />
    </svg>
  );
}

function ShieldIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.5 19 6v5.5c0 4.6-3 7.4-7 9-4-1.6-7-4.4-7-9V6l7-2.5Z"
        stroke="currentColor"
        strokeWidth={stroke(active)}
        strokeLinejoin="round"
      />
      <path d="M9.3 12.2l1.9 1.9 3.6-3.8" stroke="currentColor" strokeWidth={stroke(active)} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
