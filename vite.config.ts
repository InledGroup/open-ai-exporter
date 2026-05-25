import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [preact()],
  build: {
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'index.html'),
        content: resolve(__dirname, 'src/content_script/index.ts'),
        background: resolve(__dirname, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
        // Forzamos que no haya troceado de código (chunks)
        manualChunks: undefined,
        // Usamos ESM para popup y background, pero para content script necesitamos algo que no use imports si no es un modulo
        // Pero en Chrome V3 se pueden usar modulos en content scripts si se declaran
        // Como no queremos complicaciones, intentaremos que todo sea un solo archivo por entrada.
      },
    },
  },
});
