import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import obfuscator from 'rollup-plugin-javascript-obfuscator';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    base: './',
    plugins: [
      react(),
      mode === 'production' ? obfuscator({
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.75,
        deadCodeInjection: true,
        deadCodeInjectionThreshold: 0.4,
        debugProtection: false, // Set to false to avoid issues in Electron
        debugProtectionInterval: 0,
        disableConsoleOutput: true,
        identifierNamesGenerator: 'hexadecimal',
        log: false,
        numbersToExpressions: true,
        renameGlobals: false,
        selfDefending: true,
        simplify: true,
        splitStrings: true,
        splitStringsChunkLength: 10,
        stringArray: true,
        stringArrayCallsTransform: true,
        stringArrayCallsTransformThreshold: 0.75,
        stringArrayEncoding: ['base64'],
        stringArrayIndexesType: ['hexadecimal-number'],
        stringArrayIndexShift: true,
        stringArrayRotate: true,
        stringArrayShuffle: true,
        stringArrayWrappersCount: 2,
        stringArrayWrappersChainedCalls: true,
        stringArrayWrappersParametersMaxCount: 4,
        stringArrayWrappersType: 'function',
        stringArrayThreshold: 0.75,
        transformObjectKeys: true,
        unicodeEscapeSequence: false
      }) : null
    ].filter(Boolean) as any,
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      minify: 'terser',
      sourcemap: false, // SECURITY: Disable source maps in production
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
        mangle: true, // Obfuscate variable names
      },
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor': ['react', 'react-dom'],
            'framer': ['framer-motion'],
            'icons': ['lucide-react'],
            'pdf': ['jspdf', 'html2canvas'],
            'crypto': ['hash-wasm', 'zxcvbn'],
            'db': ['dexie']
          }
        }
      }
    }
  };
});
