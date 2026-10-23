import fs from 'node:fs/promises';
import path from 'node:path';

const CONFIG_DIR = path.resolve(process.cwd(), 'data');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export interface ApiEndpoint {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface AppConfig {
  endpoints: ApiEndpoint[];
  activeEndpointId: string | null;
}

let cache: AppConfig | null = null;

export async function loadConfig(): Promise<AppConfig> {
  if (cache) return cache;

  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf8');
    cache = JSON.parse(raw);
    return cache!;
  } catch {
    const cfg: AppConfig = { endpoints: [], activeEndpointId: null };

    // 首次启动，从 .env 迁移一个端点
    if (process.env.OPENROUTER_API_KEY) {
      const ep: ApiEndpoint = {
        id: 'default',
        name: '默认端点',
        baseUrl: process.env.BASE_URL ?? 'https://open.bigmodel.cn/api/paas/v4',
        apiKey: process.env.OPENROUTER_API_KEY,
        model: process.env.MODEL ?? 'glm-4-flash',
      };
      cfg.endpoints.push(ep);
      cfg.activeEndpointId = ep.id;
    }

    await saveConfig(cfg);
    return cfg;
  }
}

export async function saveConfig(cfg: AppConfig): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
  cache = cfg;
}

export function getActiveEndpoint(cfg: AppConfig): ApiEndpoint | null {
  if (!cfg.activeEndpointId) return null;
  return cfg.endpoints.find(e => e.id === cfg.activeEndpointId) ?? null;
}