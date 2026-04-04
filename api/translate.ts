import { handleTranslateApi } from '../src/server/translate-api.js';

export default async function handler(
  req: Parameters<typeof handleTranslateApi>[0],
  res: Parameters<typeof handleTranslateApi>[1],
) {
  if (await handleTranslateApi(req, res)) {
    return;
  }

  res.statusCode = 404;
  res.end('Not Found');
}
