import { pressKeys } from '../src/win-input.js';

export default {
  name: 'keyboard_press',
  description:
    '按下一个键或组合键。例如 "enter"、"esc"、"tab"、"ctrl+c"、"alt+f4"、"ctrl+shift+esc"。多个键用 + 连接。',
  parameters: {
    type: 'object',
    properties: {
      keys: { type: 'string', description: '要按的键，例如 ctrl+c' },
    },
    required: ['keys'],
  },
  async execute(args: { keys: string }) {
    await pressKeys(args.keys);
    return `已按下 ${args.keys}`;
  },
};