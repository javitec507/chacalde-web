// Second build: the Mystery Pack claim page (/canje). It is served by server/mp/routes.mjs only while the
// campaign is on (and as a preview inside the console), never from the public dist/ folder, so it stays hidden.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: 'server/mp/build',
    emptyOutDir: true,
    assetsInlineLimit: 0,
    cssCodeSplit: false,
    sourcemap: false,
    rollupOptions: {
      input: 'src/canje/main.jsx',
      output: { format: 'iife', entryFileNames: 'canje.js', assetFileNames: 'canje[extname]', inlineDynamicImports: true }
    }
  }
});
