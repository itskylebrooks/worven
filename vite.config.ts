import fs from 'node:fs';
import type { ServerOptions as HttpsServerOptions } from 'node:https';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { handleTranslateApi } from './src/server/translate-api';

export default defineConfig(({ command }) => {
  const isDev = command === 'serve';
  const isTest = process.env.VITEST === 'true';
  const useDevHttps = process.env.WORVEN_DEV_HTTPS === 'true';
  const https =
    !isDev || isTest || !useDevHttps
      ? undefined
      : (() => {
          const keyPath = './certs/localhost-key.pem';
          const certPath = './certs/localhost.pem';

          if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
            return {
              key: fs.readFileSync(keyPath),
              cert: fs.readFileSync(certPath),
            } satisfies HttpsServerOptions;
          }

          console.warn(
            '\x1b[33m[dev] HTTPS is enabled but certs were not found in ./certs. Run `pnpm run gen:certs` to create trusted certs.\x1b[0m',
          );

          throw new Error(
            'Missing HTTPS certs for WORVEN_DEV_HTTPS=true. Generate them with `pnpm run gen:certs`.',
          );
        })();

  return {
    server: {
      host: true,
      https,
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['icons/*.png', 'icons/*.svg', 'icons/*.ico', 'fonts/*'],
        manifest: false,
        workbox: {
          globPatterns: isDev ? [] : ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
      {
        name: 'worven-translate-api',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (await handleTranslateApi(req as never, res as never)) {
              return;
            }

            next();
          });
        },
        configurePreviewServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (await handleTranslateApi(req as never, res as never)) {
              return;
            }

            next();
          });
        },
      },
    ],
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      css: true,
    },
  };
});
