import { typeText } from '../src/win-input.js';

export default {
  name: 'keyboard_type',
  description:
    '在当前光标位置输入一段文字（支持中文）。相当于把文字粘贴到当前输入焦点。使用前请确保目标输入框已被点击激活。',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: '要输入的文字' },
    },
    required: ['text'],
  },
  async execute(args: { text: string }) {
    await typeText(args.text);
    return `已输入 ${args.text.length} 个字符`;
  },
};