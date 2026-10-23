import { clickAt } from '../src/win-input.js';

export default {
  name: 'mouse_click',
  description: '把鼠标移动到屏幕上的指定坐标并点击。',
  parameters: {
    type: 'object',
    properties: {
      x: { type: 'number', description: '屏幕 X 坐标（像素）' },
      y: { type: 'number', description: '屏幕 Y 坐标（像素）' },
      button: {
        type: 'string',
        enum: ['left', 'right', 'middle'],
        description: '鼠标键，默认左键',
      },
    },
    required: ['x', 'y'],
  },
  async execute(args: { x: number; y: number; button?: 'left' | 'right' | 'middle' }) {
    await clickAt(args.x, args.y, args.button ?? 'left');
    const b = args.button === 'right' ? '右键' : args.button === 'middle' ? '中键' : '左键';
    return `已${b}点击 (${args.x}, ${args.y})`;
  },
};