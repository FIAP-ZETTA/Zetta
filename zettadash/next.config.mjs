/** @type {import('next').NextConfig} */
const nextConfig = {
  // Necessário para o Docker multi-stage (Dockerfile usa node server.js)
  output: 'standalone',
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
