import screenshot from 'screenshot-desktop';

export default {
  name: 'screenshot',
  description:
    '截取当前主屏幕的画面。返回图像供你查看屏幕上有什么内容，你可以根据图像找出要点击的坐标。坐标原点在屏幕左上角。',
  parameters: { type: 'object', properties: {} },
  async execute() {
    const buf = await screenshot({ format: 'jpg' });
    const dataUrl = `data:image/jpeg;base64,${buf.toString('base64')}`;
    return {
      text: `已截屏（${(buf.length / 1024).toFixed(0)} KB）`,
      images: [dataUrl],
    };
  },
};