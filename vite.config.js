import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: 'index.html'
      }
    }
  },
  optimizeDeps: {
    entries: ['src/main.jsx'],
    include: ['react', 'react-dom/client']
  }
});
