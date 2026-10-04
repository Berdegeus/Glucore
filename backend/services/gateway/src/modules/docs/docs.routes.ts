import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';

/**
 * Where the contract lives: next to `package.json`, one level above both `src/`
 * (ts-node-dev) and `dist/` (production image), so the same path resolves in
 * both. The file is read per request, not cached, so editing it needs no restart
 * in development; it is a few KB and the route is not on any hot path.
 */
const SPEC_PATH = path.resolve(__dirname, '..', '..', '..', 'openapi.yaml');

/**
 * Swagger UI is loaded from a CDN instead of vendored as an npm dependency: the
 * gateway image is already ~720 MB and the page only has to render a contract.
 * Pinned to a major version so a breaking release cannot change it under us.
 */
const SWAGGER_UI_VERSION = '5';

const PAGE = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Glucore API</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({ url: 'openapi.yaml', dom_id: '#swagger-ui', deepLinking: true });
  </script>
</body>
</html>`;

/** Public documentation: no authentication, and nothing here touches user data. */
export function createDocsRouter(): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.type('html').send(PAGE);
  });

  router.get('/openapi.yaml', (_req, res) => {
    res.type('application/yaml').send(fs.readFileSync(SPEC_PATH, 'utf8'));
  });

  return router;
}
