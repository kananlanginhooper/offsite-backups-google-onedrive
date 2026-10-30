import type { Express, Request, Response } from 'express';
import express from 'express';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Serves the built Angular UI. index.html gets <base href> = UI_BASE_PATH at request time, so one
 * build works at /, behind a path prefix, or on a subdomain. index.html is never cached, so a new
 * deploy shows at once (also inside the dashboard shell's frame); the hashed bundles it names are.
 */
export function serveUi(
  server: Express,
  distDir: string,
  basePath: string,
): boolean {
  const dist = resolve(distDir);
  const indexFile = join(dist, 'index.html');
  if (!existsSync(indexFile)) return false;

  const index = readFileSync(indexFile, 'utf8').replace(
    /<base href="[^"]*"\s*\/?>/,
    `<base href="${basePath}">`,
  );
  server.use(
    express.static(dist, {
      index: false,
      setHeaders: (res, path) =>
        res.setHeader(
          'Cache-Control',
          /-[A-Z0-9]{8}\.(js|css)$/.test(path)
            ? 'public, max-age=31536000, immutable'
            : 'no-cache',
        ),
    }),
  );
  server.get(/^(?!\/api(\/|$)).*/, (_req: Request, res: Response) => {
    res.set('Cache-Control', 'no-cache').type('html').send(index);
  });
  return true;
}
