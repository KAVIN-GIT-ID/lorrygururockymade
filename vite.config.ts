import tailwindcss from '@tailwindcss/vite';
import solid from 'vite-plugin-solid';
import path from 'path';
import {defineConfig} from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { visualizer } from 'rollup-plugin-visualizer';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig(() => {
  const analyzeBundle = process.env.ANALYZE === 'true';
  return {
    plugins: [
      solid(),
      tailwindcss(),
      // Only load cloudflare plugin if explicitly requested (prevents miniflare Windows EPERM HMR crashes)
      ...(process.env.USE_CLOUDFLARE === 'true' ? [cloudflare()] : []),
      basicSsl(),
      // Keep the analyzer out of production builds. Generate it explicitly
      // with `ANALYZE=true npm run build` when investigating bundle size.
      ...(analyzeBundle ? [visualizer({
        filename: 'stats.html',
        gzipSize: true,
        brotliSize: true,
      })] : []),
    ],
    optimizeDeps: {
      entries: ['index.html', 'track.html']
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      allowedHosts: ['local.lorryguru.in'],
      https: true as any,
      proxy: {
        '/api/payment': {
          target: 'http://127.0.0.1:5000',
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on('error', (_err, _req, res) => {
              if (res && !res.headersSent) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Local backend server offline' }));
              }
            });
          }
        },
        '/api/database': {
          target: 'http://127.0.0.1:5000',
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on('error', (_err, _req, res) => {
              if (res && !res.headersSent) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Local backend server offline' }));
              }
            });
          }
        },
        '/realtime': {
          target: 'http://127.0.0.1:5000',
          ws: true,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on('error', () => {});
          }
        }
      }
    },
    build: {
      sourcemap: true,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            // Solid Core
            'vendor-solid': ['solid-js', '@solidjs/router'],
            // Appwrite SDK — large, changes rarely
            'vendor-appwrite': ['appwrite'],
            // Icon library — large, changes rarely
            'vendor-lucide': ['lucide-solid'],
          },
        },
      },
    },
  };
});
