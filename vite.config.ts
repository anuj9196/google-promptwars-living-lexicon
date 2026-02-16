import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./tests/setup.js'],
      dangerouslyIgnoreUnhandledErrors: true,
      include: [
        '**/*.test.{ts,tsx,js}',
        'tests/**/*.test.{ts,tsx,js}',
      ],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov', 'json-summary'],
        reportsDirectory: './coverage',
        include: [
          'services/**/*.{js,ts}',
          'middleware/**/*.js',
          'components/**/*.tsx',
          'App.tsx',
        ],
        exclude: [
          '**/*.test.*',
          'tests/**',
          'node_modules/**',
          'vite.config.ts',
        ],
        thresholds: {
          statements: 70,
          branches: 60,
          functions: 70,
          lines: 70,
        },
      },
    },
  };
});
