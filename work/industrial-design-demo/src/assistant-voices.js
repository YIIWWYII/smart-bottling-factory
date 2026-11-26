export const voicePreviewText = '你好，这里是朗读试听。';

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
