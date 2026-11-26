import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { localVoices } from './src/assistant-voices.js';

const require = createRequire(import.meta.url);
export const modelDirectory = '.runtime/assistant-voices/vits-icefall-zh-aishell3';
// ASCII relative paths also work when the Windows checkout path contains Chinese characters.
const modelFile = (name) => `${modelDirectory}/${name}`;
const rules = ['phone.fst', 'date.fst', 'number.fst', 'new_heteronym.fst'];
export const voiceModelFiles = ['model.onnx', 'lexicon.txt', 'tokens.txt', ...rules];
export const voiceModelReady = () => voiceModelFiles.every((name) => existsSync(modelFile(name)));
let engine;
let active = 0;
const error = (message, status) => Object.assign(new Error(message), { status });

function getEngine() {
  if (!voiceModelReady()) throw error('离线语音模型未安装，请运行 npm run voices:download。', 503);
  if (!engine) {
    try {
      const { OfflineTts } = require('sherpa-onnx-node');
      engine = OfflineTts.createAsync({
        model: { vits: { model: modelFile('model.onnx'), lexicon: modelFile('lexicon.txt'), tokens: modelFile('tokens.txt') }, numThreads: 2, provider: 'cpu' },
        maxNumSentences: 2,
        ruleFsts: rules.map(modelFile).join(','),
      }).catch(() => { engine = undefined; throw error('离线语音模型无法加载。', 503); });
    } catch { throw error('当前服务未安装离线语音组件。', 503); }
  }
  return engine;
}

export async function renderAssistantSpeech(body) {
  const voice = localVoices.find(({ id }) => id === body?.voice);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!voice || !text || text.length > 240) throw error('请提供有效的音色和不超过 240 字的正文。', 400);
  if (active >= 2) throw error('离线语音正在处理其他请求。', 429);
  active++;
  try {
    const tts = await getEngine();
    const { samples, sampleRate } = await tts.generateAsync({ text, sid: voice.speaker, speed: 1 });
    if (!samples?.length) throw error('没有生成可播放的音频。', 422);
    const size = samples.length * 2;
    const wav = Buffer.alloc(44 + size);
    wav.write('RIFF', 0); wav.writeUInt32LE(36 + size, 4); wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
    wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
    wav.write('data', 36); wav.writeUInt32LE(size, 40);
    for (let i = 0; i < samples.length; i++) wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
    return wav;
  } finally { active--; }
}
