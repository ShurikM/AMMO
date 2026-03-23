import { defineConfig } from 'vite';

export default defineConfig({
  base: '/ammo/',
  root: '.',
  build: {
    outDir: 'dist',
  },
  server: {
    open: true,
  },
});
