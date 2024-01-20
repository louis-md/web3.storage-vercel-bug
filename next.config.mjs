/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['directus.messari.io']
  },
  staticPageGenerationTimeout: 180,
  generateBuildId: () => 'build',
  webpack: config => {
    config.resolve.fallback = {
      net: false,
      tls: false,
      fs: false,
      path: false,
      assert: ['assert'],
      stream: ['stream-browserify'],
      crypto: ['crypto-browserify'],
      http: ['stream-http'],
      https: ['https-browserify'],
      os: ['os-browserify']
    }
    return config
  }
}

export default nextConfig
