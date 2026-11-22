import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
// @ts-ignore - plain JS server module shared by dev and preview
import { howishApi } from './server/api.mjs';

export default defineConfig({
  plugins: [react(), tailwindcss(), howishApi()],
  build: {
    chunkSizeWarningLimit: 2500,
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
