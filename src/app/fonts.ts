import { IBM_Plex_Mono, IBM_Plex_Sans, Manrope, Mrs_Saint_Delafield } from 'next/font/google';

export const manrope = Manrope({ subsets: ['latin'], weight: ['500', '700', '800'], variable: '--font-manrope', display: 'swap' });
export const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-plex-sans',
  display: 'swap',
});
export const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono', display: 'swap' });
export const saintDelafield = Mrs_Saint_Delafield({ subsets: ['latin'], weight: '400', variable: '--font-saint-delafield', display: 'swap' });

export const fontVariables = [manrope.variable, plexSans.variable, plexMono.variable, saintDelafield.variable].join(' ');
