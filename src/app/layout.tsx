import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CCRO — Credit Card Rewards Optimiser',
  description: 'AI-powered credit card rewards advisor',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
