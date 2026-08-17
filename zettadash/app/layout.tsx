import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { DashboardShell } from '@/components/dashboard-shell'
import { ThemeProvider } from '@/lib/theme-provider'
import { LanguageProvider } from '@/lib/language-provider'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Zetta Guard | Plataforma de Cibersegurança',
  description:
    'Zetta Guard — monitoramento de ameaças, varredura de vulnerabilidades e histórico de ataques em tempo real.',
  generator: 'ZettaGuard',
  icons: {
    icon: [
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
      {
        url: '/zetta-guard-logo.png',
        type: 'image/png',
      },
    ],
    apple: '/zetta-guard-logo.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#05070c' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="pt-BR"
      className={`dark ${geistSans.variable} ${geistMono.variable}`}
      data-color="cyan"
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const m = localStorage.getItem('zetta-theme-mode') || 'dark';
                const c = localStorage.getItem('zetta-theme-color') || 'cyan';
                document.documentElement.className = m + ' ${geistSans.variable} ${geistMono.variable}';
                document.documentElement.setAttribute('data-color', c);
              } catch(e){}
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased bg-background text-foreground">
        <LanguageProvider>
          <ThemeProvider>
            <DashboardShell>{children}</DashboardShell>
          </ThemeProvider>
        </LanguageProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
