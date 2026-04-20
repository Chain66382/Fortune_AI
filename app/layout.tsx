import type { Metadata } from 'next';
import { AppHeader } from '@/components/AppHeader';
import { AuthProvider } from '@/components/AuthProvider';
import '@/app/globals.css';

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
      <body>
        <AuthProvider>
          <AppHeader />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
