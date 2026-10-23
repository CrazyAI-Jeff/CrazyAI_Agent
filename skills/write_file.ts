import fs from 'node:fs/promises';
import path from 'node:path';
import { safePath } from '../src/workspace.js';

export default {
  name: 'write_file',
  description: '将内容写入文件（覆盖）',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string' },
      content: { type: 'string' },
    },
    required: ['path', 'content'],
  },
  async execute(args: { path: string; content: string }) {
    const full = safePath(args.path);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, args.content, 'utf8');
    return `已写入 ${args.path}（${args.content.length} 字符）`;
  },
};