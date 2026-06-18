/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // small Docker image
  // In local dev the vendor + admin portals run from the same folder; give each
  // its own build dir so their .next caches don't clobber each other. Docker
  // builds don't set NEXT_DEV_DISTDIR, so they use the default '.next'.
  distDir: process.env.NEXT_DEV_DISTDIR || '.next',
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  },
};

module.exports = nextConfig;
