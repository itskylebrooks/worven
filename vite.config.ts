import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { handleTranslateApi } from './src/server/translate-api';

export default defineConfig({
  plugins: [
    react(),
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
});
