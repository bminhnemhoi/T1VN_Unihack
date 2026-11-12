import { IBM_Plex_Mono, Inter_Tight } from 'next/font/google';

// Landing-only faces (the body face, Be Vietnam Pro, comes from the root layout as --font-sans). Inter Tight is the
// closest free, Vietnamese-capable match for the heavy grotesk the landing direction asked for; IBM Plex Mono stands in
// for Suisse Mono on numbers and labels. Both carry the vietnamese subset.
export const landingDisplay = Inter_Tight({
  subsets: ['latin', 'vietnamese'],
  weight: ['700', '800', '900'],
  variable: '--font-lp-display',
  display: 'swap',
});

export const landingMono = IBM_Plex_Mono({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500'],
  variable: '--font-lp-mono',
  display: 'swap',
});
