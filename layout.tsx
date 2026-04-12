// ═══════════════════════════════════════════════════════════
// CCRO — Root Layout
// ═══════════════════════════════════════════════════════════

import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: {
    template: '%s | CCRO',
    default: 'CCRO — Credit Card Rewards Optimiser',
  },
  description: 'The AI-native credit card rewards optimiser for India\'s premium cardholders. Get precise redemption advice for Axis Magnus, HDFC Infinia, Amex, and more.',
  keywords: ['credit card rewards', 'axis magnus', 'hdfc infinia', 'points redemption', 'india'],
  robots: 'index, follow',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,     // prevents iOS zoom on input focus
  themeColor: '#d4820a',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-white text-gray-900 antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
