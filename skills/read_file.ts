import fs from 'node:fs/promises';
import { safePath } from '../src/workspace.js';

export default {
  name: 'read_file',
  description: '读取文件内容',
  parameters: {
    type: 'object',
    properties: { path: { type: 'string', description: '文件路径' } },
    required: ['path'],
  },
  async execute(args: { path: string }) {
    return await fs.readFile(safePath(args.path), 'utf8');
  },
};