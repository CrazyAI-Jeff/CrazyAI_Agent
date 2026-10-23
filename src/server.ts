import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { initSkills, reloadSkills, listSkillMeta, runAgentStream } from './agent.js';
import { loadConfig, saveConfig, getActiveEndpoint, type ApiEndpoint } from './config.js';
import { listSessions, createSession, deleteSession, loadMessages } from './sessions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.resolve(process.cwd(), 'skills');
const app = express();

app.use(express.json({ limit: '4mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

/* ---------------- 会话 ---------------- */

app.get('/api/sessions', async (_req, res) => {
  res.json(await listSessions());
});

app.post('/api/sessions', async (_req, res) => {
  res.json(await createSession());
});

app.delete('/api/sessions/:id', async (req, res) => {
  await deleteSession(req.params.id);
  res.json({ ok: true });
});

app.get('/api/sessions/:id/messages', async (req, res) => {
  res.json(await loadMessages(req.params.id));
});

/* ---------------- 聊天（SSE 流式） ---------------- */

app.post('/api/chat/stream', async (req, res) => {
  const { sessionId, message } = req.body ?? {};
  if (!sessionId || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: '缺少 sessionId 或 message' });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const keepAlive = setInterval(() => {
    res.write(': ping\n\n');
  }, 15000);

  try {
    for await (const event of runAgentStream(sessionId, message.trim())) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  } catch (e: any) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: e.message })}\n\n`);
  } finally {
    clearInterval(keepAlive);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

/* ---------------- 技能 ---------------- */

app.get('/api/skills', (_req, res) => {
  res.json(listSkillMeta());
});

app.post('/api/skills', async (req, res) => {
  const { filename, content } = req.body ?? {};
  if (!filename || !content) {
    return res.status(400).json({ error: '缺少 filename 或 content' });
  }
  if (!/^[\w-]+\.(ts|js)$/.test(filename)) {
    return res.status(400).json({ error: '文件名必须形如 xxx.ts' });
  }

  try {
    await fs.mkdir(SKILLS_DIR, { recursive: true });
    await fs.writeFile(path.join(SKILLS_DIR, filename), content, 'utf8');
    await reloadSkills();
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ---------------- API 端点配置 ---------------- */

app.get('/api/endpoints', async (_req, res) => {
  const cfg = await loadConfig();
  res.json(cfg);
});

app.post('/api/endpoints', async (req, res) => {
  const cfg = await loadConfig();
  const ep: ApiEndpoint = {
    id: req.body?.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)),
    name: String(req.body?.name ?? '未命名'),
    baseUrl: String(req.body?.baseUrl ?? '').replace(/\/$/, ''),
    apiKey: String(req.body?.apiKey ?? ''),
    model: String(req.body?.model ?? ''),
  };

  if (!ep.baseUrl || !ep.model) {
    return res.status(400).json({ error: 'baseUrl 和 model 必填' });
  }

  const idx = cfg.endpoints.findIndex(e => e.id === ep.id);
  if (idx >= 0) cfg.endpoints[idx] = ep;
  else cfg.endpoints.push(ep);

  if (!cfg.activeEndpointId) cfg.activeEndpointId = ep.id;

  await saveConfig(cfg);
  res.json({ ok: true, endpoint: ep });
});

app.delete('/api/endpoints/:id', async (req, res) => {
  const cfg = await loadConfig();
  cfg.endpoints = cfg.endpoints.filter(e => e.id !== req.params.id);
  if (cfg.activeEndpointId === req.params.id) {
    cfg.activeEndpointId = cfg.endpoints[0]?.id ?? null;
  }
  await saveConfig(cfg);
  res.json({ ok: true });
});

app.post('/api/endpoints/active', async (req, res) => {
  const cfg = await loadConfig();
  const id = req.body?.id ?? null;
  if (id && !cfg.endpoints.find(e => e.id === id)) {
    return res.status(400).json({ error: '端点不存在' });
  }
  cfg.activeEndpointId = id;
  await saveConfig(cfg);
  res.json({ ok: true });
});

app.post('/api/endpoints/test', async (req, res) => {
  const { baseUrl, apiKey, model } = req.body ?? {};
  if (!baseUrl || !model) {
    return res.status(400).json({ error: '缺少 baseUrl 或 model' });
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const t0 = Date.now();
  try {
    const r = await fetch(`${String(baseUrl).replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
      }),
    });
    const elapsed = Date.now() - t0;
    const text = await r.text();

    if (r.ok) {
      res.json({ ok: true, status: r.status, elapsed, preview: text.slice(0, 200) });
    } else {
      res.json({ ok: false, status: r.status, elapsed, error: text.slice(0, 500) });
    }
  } catch (e: any) {
    res.json({ ok: false, error: e.message, elapsed: Date.now() - t0 });
  }
});

/* ---------------- 启动 ---------------- */

await initSkills();

app.listen(3000, () => {
  console.log('打开 http://localhost:3000');
});