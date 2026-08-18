/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/scan/:path*',
        destination: `${process.env.ZETTASCAN_INTERNAL_URL || 'http://localhost:8000'}/:path*`,
      },
      {
        source: '/api/guard/:path*',
        destination: `${process.env.ZETTAGUARD_INTERNAL_URL || 'http://localhost:8002'}/:path*`,
      },
    ]
  },
}

export default nextConfig
