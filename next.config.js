/** @type {import('next').NextConfig} */
const nextConfig = {
  // Telegram webhook needs raw body — disable body size limit for the route
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

export default nextConfig;
