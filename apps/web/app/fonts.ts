import { IBM_Plex_Mono, Inter_Tight } from 'next/font/google';

// The two type families of the app and the landing (lamng-design-rule §3: at most two, both with Vietnamese glyphs).
// Inter Tight is loaded as its variable font (one file per subset covers 400-900); IBM Plex Mono carries numbers and labels.
export const sans = Inter_Tight({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-sans',
  display: 'swap',
});

export const mono = IBM_Plex_Mono({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});
