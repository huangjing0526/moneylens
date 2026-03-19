import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/layout/sidebar';
import { TabBar } from '@/components/layout/tab-bar';
import { Toaster } from 'sonner';
import { SWRegister } from '@/components/pwa/sw-register';

const geistSans = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#007aff',
};

export const metadata: Metadata = {
  title: '钱迹',
  description: '本地记账分析应用 - 导入账单，自动分类，可视化分析',
  icons: { icon: '/icon.svg', apple: '/icons/icon-192.png' },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '钱迹',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} font-sans antialiased bg-[#f2f2f7]`}>
        <Sidebar />
        <main className="md:ml-16 pb-20 md:pb-0 min-h-screen">
          <div className="max-w-2xl mx-auto px-4 py-6">
            {children}
          </div>
        </main>
        <TabBar />
        <Toaster position="top-center" richColors />
        <SWRegister />
      </body>
    </html>
  );
}
