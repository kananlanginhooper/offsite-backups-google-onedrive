import type { Express, Request, Response } from 'express';
import express from 'express';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Serves the built Angular UI. index.html gets <base href> = UI_BASE_PATH at request time, so one
 * build works at /, behind a path prefix, or on a subdomain.
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
  server.use(express.static(dist, { index: false }));
  server.get(/^(?!\/api(\/|$)).*/, (_req: Request, res: Response) => {
    res.type('html').send(index);
  });
  return true;
}
