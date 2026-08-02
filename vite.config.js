import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Three.js is the single heaviest dependency (~600KB raw). Split
          // it (and R3F/drei on top) into a long-cacheable vendor chunk so
          // the initial script load parallelizes and app-only edits don't
          // re-ship the whole 3D engine.
          three: ['three'],
          'react-three': ['@react-three/fiber', '@react-three/drei'],
          zustand: ['zustand'],
        },
      },
    },
  },
});
