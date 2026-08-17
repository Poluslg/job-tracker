import type { NextConfig } from 'next';

const config: NextConfig = {

  transpilePackages: ['@job-ai/types', '@job-ai/core', '@job-ai/ai', '@job-ai/ui'],

  typedRoutes: true,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [

          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default config;
