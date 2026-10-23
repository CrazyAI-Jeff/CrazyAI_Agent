import { moveTo } from '../src/win-input.js';

export default {
  name: 'mouse_move',
  description: '把鼠标移动到屏幕上的指定坐标（不点击）。',
  parameters: {
    type: 'object',
    properties: {
      x: { type: 'number', description: '屏幕 X 坐标' },
      y: { type: 'number', description: '屏幕 Y 坐标' },
    },
    required: ['x', 'y'],
  },
  async execute(args: { x: number; y: number }) {
    await moveTo(args.x, args.y);
    return `鼠标已移动到 (${args.x}, ${args.y})`;
  },
};