import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Providers } from '@/components/providers';
import './globals.css';
const lexend = localFont({ src: '../../public/fonts/Lexend-VariableFont_wght.ttf', display: 'swap', variable: '--font-lexend' });
export const metadata: Metadata = { title: 'RRFLOW · Your context, connected', description: 'Visible memories, connected knowledge, and source-backed decisions for life and Shippin work. Built on Digo app-starter and HydraDB.' };
const RootLayout = ({ children }: Readonly<{ children: React.ReactNode }>) => (
  <html lang="en" suppressHydrationWarning><body className={lexend.variable}><Providers>{children}</Providers></body></html>
);
export default RootLayout;

