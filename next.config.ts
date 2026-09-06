import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Route handlers touch Prisma, which needs the Node runtime rather than Edge.
  serverExternalPackages: ['@prisma/client'],
};

export default nextConfig;
