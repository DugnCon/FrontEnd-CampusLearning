/*-----------------------------------------------------------------
* File: vite.config.js
* Author: Quyen Nguyen Duc
* Date: 2025-07-24
* Description: This file is a component/module for the student application.
* Apache 2.0 License - Copyright 2025 Quyen Nguyen Duc
-----------------------------------------------------------------*/
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
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
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  publicDir: 'public',
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
        external: ['simple-peer'],
      }
    }
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
