import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { greenCartApiPlugin } from './src/server/apiPlugin.ts';

export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE_PATH || './',
  plugins: [
    react(),
    tailwindcss(),
    ...(mode === 'test' ? [] : [greenCartApiPlugin()]),
  ],
}));
