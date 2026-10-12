'use client';
import { ThemeProvider } from 'next-themes';
import { ActivityProvider } from '@/components/transparency/activity-provider';
import { Toaster } from '@/components/ui/sonner';
export const Providers = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
    <ActivityProvider>{children}</ActivityProvider>
    {/* Lifted above the always-visible "What RRFLOW did" button so a toast never hides it. */}
    <Toaster position="bottom-right" offset={{ bottom: 72, right: 16 }} />
  </ThemeProvider>
);
