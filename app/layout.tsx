import type { Metadata } from 'next';
import { Figtree, Noto_Sans } from 'next/font/google';
import './globals.css';
import { Nav } from '@/components/Nav';
import { AuthGate } from '@/components/AuthGate';

const figtree = Figtree({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-figtree',
  display: 'swap',
});

const notoSans = Noto_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PillID — your calm medicine cabinet',
  description:
    'Identify pills from a photo and check interactions across your medicine cabinet. Drug facts are grounded in openFDA labels and RxNorm.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${figtree.variable} ${notoSans.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:btn-primary"
        >
          Skip to content
        </a>
        {/* Ambient decorative blobs (cosmetic only). The wrapper clips them: they
            hang off the screen edge, and unclipped they make the page wider than
            the phone, which pushes the fixed bottom nav off-screen. */}
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="blob left-[-6rem] top-24 h-72 w-72 bg-sage-200" />
          <div className="blob right-[-8rem] top-[28rem] h-80 w-80 bg-sage-100" />
        </div>

        <Nav />
        <main id="main" className="relative mx-auto w-full max-w-3xl px-4 pb-28 pt-6 sm:px-6">
          <AuthGate>{children}</AuthGate>
        </main>
      </body>
    </html>
  );
}
