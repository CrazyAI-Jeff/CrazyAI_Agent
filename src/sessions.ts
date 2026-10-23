import fs from 'node:fs/promises';
import path from 'node:path';

const SESSIONS_DIR = path.resolve(process.cwd(), 'data', 'sessions');

export interface SessionMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

function safeId(id: string): string {
  if (!/^[a-z0-9]+$/i.test(id)) throw new Error('非法会话 ID');
  return id;
}

function fileFor(id: string) {
  return path.join(SESSIONS_DIR, `${safeId(id)}.jsonl`);
}

async function ensureDir() {
  await fs.mkdir(SESSIONS_DIR, { recursive: true });
}

export async function listSessions(): Promise<SessionMeta[]> {
  await ensureDir();
  const entries = await fs.readdir(SESSIONS_DIR);
  const metas: SessionMeta[] = [];

  for (const entry of entries) {
    if (!entry.endsWith('.jsonl')) continue;
    const id = entry.slice(0, -6);
    const full = path.join(SESSIONS_DIR, entry);

    try {
      const stat = await fs.stat(full);
      const raw = await fs.readFile(full, 'utf8');
      const lines = raw.split('\n').filter(Boolean);

      let title = '(新会话)';
      for (const line of lines) {
        try {
          const m = JSON.parse(line);
          if (m.role === 'user' && typeof m.content === 'string' && m.content.trim()) {
            title = m.content.trim().slice(0, 30);
            break;
          }
        } catch {}
      }

      metas.push({
        id,
        title,
        createdAt: stat.birthtimeMs,
        updatedAt: stat.mtimeMs,
        messageCount: lines.length,
      });
    } catch {}
  }

  metas.sort((a, b) => b.updatedAt - a.updatedAt);
  return metas;
}

export async function createSession(): Promise<SessionMeta> {
  await ensureDir();
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const now = Date.now();
  await fs.writeFile(fileFor(id), '', 'utf8');
  return { id, title: '(新会话)', createdAt: now, updatedAt: now, messageCount: 0 };
}

export async function deleteSession(id: string): Promise<void> {
  try {
    await fs.unlink(fileFor(id));
  } catch {}
}

export async function loadMessages(id: string): Promise<any[]> {
  try {
    const raw = await fs.readFile(fileFor(id), 'utf8');
    return raw
      .split('\n')
      .filter(Boolean)
      .map(l => {
        try { return JSON.parse(l); } catch { return null; }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function appendMessage(id: string, msg: any): Promise<void> {
  await ensureDir();
  await fs.appendFile(fileFor(id), JSON.stringify(msg) + '\n', 'utf8');
}