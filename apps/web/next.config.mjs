import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Monorepo: trace files from the repo root so packages/shared lands in the standalone bundle.
  outputFileTracingRoot: path.join(here, '../../'),
  transpilePackages: ['@tesla-pool/shared'],
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
