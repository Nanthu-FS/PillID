import type { Config } from 'tailwindcss';

/**
 * PillID — "calm pharmacy / soft" palette.
 * Soft sage greens + warm cream, high-legibility, WCAG-AA contrast.
 * Severity colors are muted (no neon) so warnings read as serious-but-calm.
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: '#FBF9F3',
          50: '#FEFDFB',
          100: '#FBF9F3',
          200: '#F5F1E6',
          300: '#EAE3D2',
        },
        sage: {
          50: '#F1F5F1',
          100: '#E3ECE4',
          200: '#C7D9C9',
          300: '#A6C2A9',
          400: '#7BA888',
          500: '#5B8266', // primary
          600: '#4A6B54',
          700: '#3C5544',
          800: '#2F4336',
          900: '#26362C',
        },
        ink: {
          DEFAULT: '#2C3A2E',
          soft: '#566153',
          faint: '#8A9387',
        },
        line: '#E5E0D3',
        // Muted severity scale
        minor: { bg: '#FBF3E2', fg: '#92651B', ring: '#E6C77E' },
        moderate: { bg: '#FBEBDD', fg: '#9A4F1E', ring: '#E5A877' },
        major: { bg: '#F7E2DC', fg: '#8F362A', ring: '#D89484' },
      },
      fontFamily: {
        heading: ['var(--font-figtree)', 'system-ui', 'sans-serif'],
        body: ['var(--font-noto-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      boxShadow: {
        soft: '0 2px 8px -2px rgba(44, 58, 46, 0.08), 0 4px 16px -4px rgba(44, 58, 46, 0.06)',
        lift: '0 6px 20px -6px rgba(44, 58, 46, 0.14)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 250ms ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
