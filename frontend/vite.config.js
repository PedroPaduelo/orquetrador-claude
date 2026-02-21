import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
        dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
        include: [
            'react',
            'react-dom',
            'react-router-dom',
            '@radix-ui/react-select',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-tabs',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-label',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-separator',
            '@radix-ui/react-slot',
            '@radix-ui/react-progress',
            '@radix-ui/react-avatar',
            '@tanstack/react-query',
            'zustand',
            'axios',
            'react-hook-form',
            '@hookform/resolvers/zod',
            'zod',
            'sonner',
            'lucide-react',
            'class-variance-authority',
            'clsx',
            'tailwind-merge',
            'react-markdown',
            'remark-gfm',
        ],
    },
    server: {
        port: 5173,
        host: '0.0.0.0',
        allowedHosts: true,
        watch: {
            usePolling: true,
            interval: 1000,
        },
        cors: true,
        proxy: {
            '/api': {
                target: 'http://localhost:3333',
                changeOrigin: true,
                rewrite: function (path) { return path.replace(/^\/api/, ''); },
            },
        },
    },
    preview: {
        host: '0.0.0.0',
        allowedHosts: true,
        cors: true,
    },
});
