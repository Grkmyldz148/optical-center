import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'optical-center · Next.js adapter',
  description: 'Verifies optical-center/next under Webpack and Turbopack.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
