import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import obfuscator from 'rollup-plugin-javascript-obfuscator'

export default defineConfig({
    plugins: [
        react(),
        process.env.NODE_ENV === 'production' && obfuscator({
            compact: true,
            stringArray: true,
            stringArrayEncoding: ['base64'],
            stringArrayThreshold: 0.75,
            numbersToExpressions: true,
            simplify: true,
            splitStrings: true,
        })
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@components': path.resolve(__dirname, './src/renderer/components'),
            '@hooks': path.resolve(__dirname, './src/renderer/hooks'),
            '@store': path.resolve(__dirname, './src/renderer/store'),
            '@services': path.resolve(__dirname, './src/renderer/services'),
            '@utils': path.resolve(__dirname, './src/renderer/utils'),
        },
    },
    base: './',
    build: {
        outDir: 'dist/renderer',
        emptyOutDir: true,
    },
    server: {
        port: 5173,
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/renderer/tests/setup.ts'],
        exclude: ['**/node_modules/**', 'tests/e2e/**', '**/dist/**'],
    },
})
