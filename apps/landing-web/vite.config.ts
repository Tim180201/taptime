import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({ test: { include: ['tests/**/*.test.ts'] }, build: { rollupOptions: { input: { index: fileURLToPath(new URL('./index.html', import.meta.url)), tag: fileURLToPath(new URL('./tag.html', import.meta.url)) } } } });
