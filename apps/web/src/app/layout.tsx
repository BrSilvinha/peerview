import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PeerView',
  description: 'Remote screen viewing platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  )
}
