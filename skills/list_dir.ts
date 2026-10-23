import fs from 'node:fs/promises';
import { safePath } from '../src/workspace.js';

export default {
  name: 'list_dir',
  description: '列出指定目录下的文件和子目录',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '目录路径，默认当前目录' },
    },
  },
  async execute(args: { path?: string }) {
    const target = safePath(args.path ?? '.');
    const entries = await fs.readdir(target, { withFileTypes: true });
    if (entries.length === 0) return '(空目录)';
    return entries
      .map(e => (e.isDirectory() ? `[目录] ${e.name}` : `[文件] ${e.name}`))
      .join('\n');
  },
};