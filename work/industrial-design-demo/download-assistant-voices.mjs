import { mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, basename, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { modelDirectory, voiceModelFiles, voiceModelReady } from './assistant-voice-local.mjs';

if (voiceModelReady()) {
  console.log(`Offline voice model ready: ${modelDirectory}`);
} else {
  const parent = dirname(modelDirectory);
  await mkdir(parent, { recursive: true });
  const temporary = await mkdtemp(join(parent, 'download-'));
  try {
    const archive = join(temporary, 'model.tar.bz2');
    const url = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-icefall-zh-aishell3.tar.bz2';
    console.log('Downloading the offline Chinese voice model (32 MB)…');
    const response = await fetch(url, { signal: AbortSignal.timeout(300_000) });
    if (!response.ok || !response.body) throw Error(`Download failed: HTTP ${response.status}`);
    await pipeline(response.body, createWriteStream(archive));
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(archive)) hash.update(chunk);
    if (hash.digest('hex') !== 'ab468db3a3308cdd861495e0db2f25d79418a0c00639f74944c7cdf5dd8c6ec1') throw Error('Invalid model archive checksum.');
    const members = voiceModelFiles.map((name) => `${basename(modelDirectory)}/${name}`);
    const extract = spawnSync('tar', ['-xf', archive, '-C', temporary, ...members], { stdio: 'inherit' });
    if (extract.status !== 0) throw extract.error || Error('Could not extract model archive.');
    await rename(join(temporary, basename(modelDirectory)), modelDirectory);
    console.log(`Offline voice model ready: ${modelDirectory}`);
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
