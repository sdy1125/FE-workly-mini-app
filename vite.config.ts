import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import ZaloMiniApp from 'zmp-vite-plugin';

export default defineConfig({
  base: '',
  cacheDir: '../.vite-cache',
  plugins: [react(), ZaloMiniApp()],
});
