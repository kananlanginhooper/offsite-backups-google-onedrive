import { z } from 'zod';

const list = z
  .string()
  .default('')
  .transform((s) => s.split(/[\s,]+/).filter(Boolean));

/** Every setting this app reads. The .env file (or the container env) is the only source. */
export const envSchema = z.object({
  PORT: z.coerce.number().int().default(8101),
  PUBLIC_URL: z.string().default(''),
  UI_BASE_PATH: z
    .string()
    .default('/')
    .transform((p) => (p.endsWith('/') ? p : `${p}/`)),
  UI_DIST: z.string().default('../ui/dist/ui/browser'),
  FRAME_ANCESTORS: list,
  FORWARDED_ALLOW_IPS: list,
  LOGIN: z.enum(['on', 'off']).default('off'),
  OIDC_ISSUER: z.string().default(''),
  OIDC_CLIENT_ID: z.string().default(''),

  // This app's own database (Postgres).
  DB_HOST: z.string(),
  DB_PORT: z.coerce.number().int().default(5432),
  DB_NAME: z.string(),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),

  // The shared recovery database (MySQL), read-only.
  RECOVERY_DB_HOST: z.string(),
  RECOVERY_DB_PORT: z.coerce.number().int().default(3306),
  RECOVERY_DB_NAME: z.string().default('recovery'),
  RECOVERY_DB_USER: z.string(),
  RECOVERY_DB_PASSWORD: z.string(),

  // rclone moves the files. Remote names come from rclone.conf.
  RCLONE_BIN: z.string().default('rclone'),
  RCLONE_CONFIG: z.string().default(''),
  GDRIVE_REMOTE: z.string().default(''),
  ONEDRIVE_REMOTE: z.string().default(''),
  RESTORE_ROOT: z.string().default('./restores'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const problems = parsed.error.issues.map(
      (i) => `${i.path.join('.')}: ${i.message}`,
    );
    throw new Error(`Invalid environment:\n  ${problems.join('\n  ')}`);
  }
  return parsed.data;
}
