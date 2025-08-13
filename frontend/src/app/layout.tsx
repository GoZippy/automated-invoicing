import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '@/styles/globals.css'
import { Providers } from '@/components/providers'
import { Toaster } from 'sonner'
import { Analytics } from '@vercel/analytics/react'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: {
    default: 'Intelligent Invoicing',
    template: '%s | Intelligent Invoicing',
  },
  description: 'AI-powered invoice management system that transforms manual invoice handling into an automated, conversational experience.',
  keywords: ['invoice', 'ai', 'automation', 'accounting', 'business', 'saas'],
  authors: [{ name: 'Intelligent Invoicing Team' }],
  creator: 'Intelligent Invoicing',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://intelligentinvoicing.com',
    title: 'Intelligent Invoicing',
    description: 'AI-powered invoice management system',
    siteName: 'Intelligent Invoicing',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Intelligent Invoicing',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Intelligent Invoicing',
    description: 'AI-powered invoice management system',
    images: ['/og-image.jpg'],
    creator: '@intelligentinvoicing',
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          {children}
          <Toaster position="bottom-right" richColors />
          <Analytics />
        </Providers>
      </body>
    </html>
  )
}