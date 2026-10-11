import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '孢子 · 从海洋走向陆地',
  icons: { icon: '/favicon.svg' },
  description:
    '从微小生命开始，探索池塘、海洋、潮间带与古蕨林，分化身体、筑巢结伴、繁衍后代。面向好奇心的生命进化冒险。',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="dark">
      <body>{children}</body>
    </html>
  );
}
