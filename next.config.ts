import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Telegram webhook needs raw body — disable body size limit for the route
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

export default nextConfig;
