import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

export interface AppConfig { readonly companionRoot: string; readonly objectRoot: string; readonly databasePath: string; readonly host: string; readonly port: number }
const pathValue = (value: unknown, fallback: string) => typeof value === 'string' && value ? (isAbsolute(value) ? value : resolve(process.cwd(), value)) : fallback;

export function loadConfig(): AppConfig {
  const filePath = resolve(process.cwd(), 'config.json');
  const file = existsSync(filePath) ? JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown> : {};
  const candidates = [process.env.FC26_COMPANION_ROOT, file.companionRoot, join(process.cwd(), '..', 'public-reference', 'fc26companion'), join(process.cwd(), 'public-reference', 'fc26companion')].filter(Boolean) as string[];
  const companionRoot = candidates.map((item) => pathValue(item, item)).find((item) => existsSync(item)) ?? '';
  return { companionRoot, objectRoot: pathValue(process.env.FC26_COMPANION_OBJECT_ROOT ?? file.objectRoot, 'data-v2/objects'), databasePath: pathValue(process.env.FC26_COMPANION_DATABASE ?? file.databasePath, 'data-v2/companion.sqlite'), host: process.env.HOST ?? String(file.host ?? '127.0.0.1'), port: Number(process.env.PORT ?? file.port ?? 4132) };
}
