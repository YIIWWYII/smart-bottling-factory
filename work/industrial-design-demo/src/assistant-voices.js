export const localVoices = [
  { id: 'local:24', speaker: 24, label: '清亮', sample: 'clear.mp3' },
  { id: 'local:9', speaker: 9, label: '柔和', sample: 'soft.mp3' },
  { id: 'local:1', speaker: 1, label: '轻快', sample: 'bright.mp3' },
  { id: 'local:67', speaker: 67, label: '沉稳', sample: 'steady.mp3' },
  { id: 'local:4', speaker: 4, label: '低柔', sample: 'low.mp3' },
  { id: 'local:89', speaker: 89, label: '亲切', sample: 'friendly.mp3' },
];
export const voicePreviewText = '你好，我是鸿眸助手。今天的产线运行得怎么样？我们一起看看吧。';

export function speechChunks(input, limit = 240) {
  const text = String(input ?? '').replace(/[#*_>`]/g, '').replace(/\s+/g, ' ').trim();
  const chunks = [];
  let part = '';
  for (const sentence of text.match(/[^。！？；!?;]+[。！？；!?;]*|[。！？；!?;]+/gu) || []) {
    if (part.length + sentence.length > limit && part) { chunks.push(part); part = ''; }
    for (const word of sentence) {
      if (part.length + word.length > limit) { chunks.push(part); part = ''; }
      part += word;
    }
  }
  if (part) chunks.push(part);
  return chunks;
}
