import { loadConfig, getActiveEndpoint } from './config.js';
import { loadSkills } from './skills/loader.js';
import type { Skill, SkillResultObject } from './skills/types.js';
import { loadMessages, appendMessage } from './sessions.js';

let skills: Skill[] = [];

export async function initSkills() {
  skills = await loadSkills();
  console.log(`已加载 ${skills.length} 个技能: ${skills.map(s => s.name).join(', ')}`);
}

export async function reloadSkills() {
  await initSkills();
}

export function listSkillMeta() {
  return skills.map(s => ({
    name: s.name,
    description: s.description,
    filename: s.filename,
  }));
}

function toolsFromSkills() {
  return skills.map(s => ({
    type: 'function' as const,
    function: {
      name: s.name,
      description: s.description,
      parameters: s.parameters,
    },
  }));
}

async function runTool(name: string, args: any): Promise<string | SkillResultObject> {
  const skill = skills.find(s => s.name === name);
  if (!skill) return `未知技能: ${name}`;
  return await skill.execute(args);
}

const SYSTEM_PROMPT = {
  role: 'system',
  content: `你是安总的专属助理，可以查看屏幕并操作鼠标键盘。
回答用中文，简洁、直接、专业。

【查看屏幕与操作电脑】
- 任务涉及"看屏幕""点击""打开某个程序""操作软件"时，先用 screenshot 看清当前屏幕。
- 截图会以图像形式出现在你的上下文中，你能直接看到。
- 坐标原点是屏幕左上角 (0, 0)，右下角是 (屏幕宽, 屏幕高)。
- 每次点击前先 screenshot 确认当前位置和状态。
- 点击后再 screenshot 确认操作是否成功。
- 不确定当前状态时，永远先 screenshot，不要盲猜坐标。
- 输入文字前，必须先点击目标输入框让它获得焦点，再用 keyboard_type。
- 不要连续快速操作，每步之间观察屏幕。`,
};

export type AgentEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_start'; name: string; args: string }
  | { type: 'tool_end'; name: string; result: string }
  | { type: 'error'; message: string }
  | { type: 'done' };

export async function* runAgentStream(
  sessionId: string,
  userText: string
): AsyncGenerator<AgentEvent> {
  const cfg = await loadConfig();
  const ep = getActiveEndpoint(cfg);

  if (!ep) {
    yield { type: 'error', message: '未配置任何 API 端点，请到「API」页面添加' };
    return;
  }

  const history = await loadMessages(sessionId);
  const messages: any[] = [SYSTEM_PROMPT];
  for (const m of history) {
    if (m.role === 'system') continue;
    messages.push(m);
  }

  const userMsg = { role: 'user', content: userText };
  messages.push(userMsg);
  await appendMessage(sessionId, userMsg);

  const tools = toolsFromSkills();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (ep.apiKey) headers['Authorization'] = `Bearer ${ep.apiKey}`;

  const url = `${ep.baseUrl.replace(/\/$/, '')}/chat/completions`;

  let step = 0;
  while (step++ < 15) {
    const body: any = {
      model: ep.model,
      messages,
      stream: true,
    };
    if (tools.length) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    let res: Response;
    try {
      res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    } catch (e: any) {
      yield { type: 'error', message: `网络错误: ${e.message}` };
      return;
    }

    if (!res.ok) {
      const t = await res.text();
      yield { type: 'error', message: `API ${res.status}: ${t.slice(0, 500)}` };
      return;
    }

    let assistantText = '';
    const toolCallsMap = new Map<number, { id: string; name: string; args: string }>();

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') continue;

        let chunk: any;
        try { chunk = JSON.parse(data); } catch { continue; }
        const delta = chunk.choices?.[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          assistantText += delta.content;
          yield { type: 'text', content: delta.content };
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCallsMap.has(idx)) {
              toolCallsMap.set(idx, { id: '', name: '', args: '' });
            }
            const entry = toolCallsMap.get(idx)!;
            if (tc.id) entry.id = tc.id;
            if (tc.function?.name) entry.name += tc.function.name;
            if (tc.function?.arguments) entry.args += tc.function.arguments;
          }
        }
      }
    }

    const toolCalls = [...toolCallsMap.values()];

    if (toolCalls.length === 0) {
      const finalMsg = { role: 'assistant', content: assistantText };
      await appendMessage(sessionId, finalMsg);
      yield { type: 'done' };
      return;
    }

    const assistantMsg = {
      role: 'assistant',
      content: assistantText || null,
      tool_calls: toolCalls.map(tc => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: tc.args },
      })),
    };
    await appendMessage(sessionId, assistantMsg);
    messages.push(assistantMsg);

    for (const tc of toolCalls) {
      yield { type: 'tool_start', name: tc.name, args: tc.args };

      let result: string | SkillResultObject;
      try {
        const args = JSON.parse(tc.args || '{}');
        result = await runTool(tc.name, args);
      } catch (e: any) {
        result = `执行失败: ${e.message}`;
      }

      let resultText: string;
      let images: string[] | undefined;

      if (typeof result === 'string') {
        resultText = result;
      } else {
        resultText = result.text;
        images = result.images;
      }

      // tool 消息落盘（只存文本）
      const toolMsg = { role: 'tool', tool_call_id: tc.id, content: resultText };
      await appendMessage(sessionId, toolMsg);
      messages.push(toolMsg);

      // 图像作为额外的 user 消息注入当前请求（不落盘）
      if (images?.length) {
        messages.push({
          role: 'user',
          content: [
            { type: 'text', text: '（以下是刚获取的图像，请查看）' },
            ...images.map(u => ({ type: 'image_url', image_url: { url: u } })),
          ],
        });
      }

      yield { type: 'tool_end', name: tc.name, result: resultText };
    }
  }

  yield { type: 'error', message: '达到最大步数，已停止' };
  yield { type: 'done' };
}