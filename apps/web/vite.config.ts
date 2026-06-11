import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// `base` solo en build de producción (GitHub Pages sirve en /soundmind/).
// En dev se queda en '/' para no romper el server de Vite.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/soundmind/' : '/',
  plugins: [react(), tailwindcss()],
}));
