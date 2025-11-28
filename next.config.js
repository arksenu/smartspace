/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Output standalone for Electron
  output: process.env.ELECTRON_BUILD === 'true' ? 'standalone' : undefined,
  // Disable image optimization in Electron (not needed)
  images: {
    unoptimized: process.env.ELECTRON_BUILD === 'true',
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.ALLOWED_ORIGINS || 'http://localhost:3000',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Ensure canvas is treated as optional (used by some PDF libraries)
      config.externals = config.externals || [];
      config.externals.push({
        canvas: 'canvas',
      });
    }

    // Disable webpack's fallback for Node.js modules in the browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    return config;
  },
}

module.exports = nextConfig
