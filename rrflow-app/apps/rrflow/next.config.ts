import type { NextConfig } from 'next';
const config: NextConfig = {
  distDir: process.env.RRFLOW_DIST_DIR || '.next',
  poweredByHeader: false,
  devIndicators: false,
  webpack(config, { dev }) {
    // Windows editor writes on /mnt/d do not reliably emit WSL file-watch events.
    if (dev) config.watchOptions = { ...config.watchOptions, poll: 1000, aggregateTimeout: 200 };
    return config;
  },
};
export default config;

