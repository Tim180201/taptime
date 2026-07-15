import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'TAPTIME_');
  const proxyTarget = env.TAPTIME_API_PROXY_TARGET;
  if (proxyTarget !== undefined && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(proxyTarget)) {
    throw new Error('TAPTIME_API_PROXY_TARGET must be a loopback origin');
  }
  return {
    plugins: [react()],
    server: proxyTarget === undefined ? undefined : { proxy: { '/v1': { target: proxyTarget, changeOrigin: false } } },
  };
});
