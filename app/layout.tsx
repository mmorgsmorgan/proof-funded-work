import './globals.css';
import '@fontsource-variable/archivo';
import '@fontsource-variable/inter';
import type { Metadata } from 'next';
import { Providers } from './providers';
import { Motion } from '../components/motion';

export const metadata: Metadata = { title: "Q'IT", description: 'Stablecoin-native work with money locked before the first task.' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><Providers><Motion />{children}</Providers></body></html>;
}
