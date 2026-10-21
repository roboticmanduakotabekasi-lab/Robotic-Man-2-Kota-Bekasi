import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const adminEmail = env.ADMIN_EMAIL || env.VITE_ADMIN_EMAIL || process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || 'roboticman2kotabekasi@gmail.com';
  const adminPassword = env.ADMIN_PASSWORD || env.VITE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || process.env.VITE_ADMIN_PASSWORD || '';

  return {
    define: {
      'process.env.ADMIN_EMAIL': JSON.stringify(adminEmail),
      'import.meta.env.VITE_ADMIN_EMAIL': JSON.stringify(adminEmail),
      'import.meta.env.ADMIN_EMAIL': JSON.stringify(adminEmail),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
