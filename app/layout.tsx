import type { Metadata } from 'next';
import { Figtree, Noto_Sans } from 'next/font/google';
import './globals.css';
import { Nav } from '@/components/Nav';

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
    'Identify pills from a photo and check interactions across your medicine cabinet. Runs locally with gemma4:12b; grounded in openFDA labels.',
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
        {/* Ambient decorative blobs (cosmetic only) */}
        <div aria-hidden className="blob left-[-6rem] top-24 h-72 w-72 bg-sage-200" />
        <div aria-hidden className="blob right-[-8rem] top-[28rem] h-80 w-80 bg-sage-100" />

        <Nav />
        <main id="main" className="relative mx-auto w-full max-w-3xl px-4 pb-28 pt-6 sm:px-6">
          {children}
        </main>
      </body>
    </html>
  );
}
