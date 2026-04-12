import type { Metadata } from 'next';
import { AppHeader } from '@/components/AppHeader';
import { AuthProvider } from '@/components/AuthProvider';
import { Cormorant_Garamond, Noto_Serif_SC } from 'next/font/google';
import '@/app/globals.css';

const displayFont = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display'
});

const bodyFont = Noto_Serif_SC({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body'
});

export const metadata: Metadata = {
  title: 'Fortune AI',
  description: 'Premium divination consultation driven by curated knowledge and personalized context.'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${displayFont.variable} ${bodyFont.variable}`}>
        <AuthProvider>
          <AppHeader />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
