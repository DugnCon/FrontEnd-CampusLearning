
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],

  // ===== DEV SERVER (local) =====
  server: {
    port: 5004,
    allowedHosts: ['.ngrok-free.app'],
    proxy: {
      '/user/api': {
        target: 'http://campuslearning.site',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/user\/api/, '/user/api'),
      },
      '/admin/api': {
        target: 'http://campuslearning.site',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/admin\/api/, '/admin/api'),
      },
      '/uploads': {
        target: 'http://campuslearning.site',
        changeOrigin: true,
        secure: false,
      },
      '/code-server': {
        target: 'http://code.campuslearning.site',
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => path.replace(/^\/code-server/, ''),
      },
      '/code-api': {
        target: 'http://code.campuslearning.site',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/code-api/, ''),
      },
    },
  },

  // ===== ALIAS =====
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  publicDir: 'public',

  // ===== BUILD (PRODUCTION) - QUAN TRỌNG =====
  build: {
    outDir: 'dist',
    sourcemap: true,
    base: '/', // <<< BẮT BUỘC CHO SUBPATH /user/
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
        external: ['simple-peer'],
      },
    },
  },

  define: {
    'process.env': {},
    global: 'window',
  },

  optimizeDeps: {
    exclude: ['simple-peer', '@wasmer/wasi', '@wasmer/wasmfs', 'pyodide', 'quickjs-emscripten'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
});