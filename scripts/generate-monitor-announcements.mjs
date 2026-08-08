import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import ffmpegPath from 'ffmpeg-static';

const API_URL = 'https://service.muxlisa.uz/api/v2/tts';
const DEFAULT_OUTPUT = 'public/monitor-announcements/v1/uz/female';
const REQUEST_INTERVAL_MS = 1100;
const MAX_ATTEMPTS = 5;

const ones = ['', 'bir', 'ikki', 'uch', "to'rt", 'besh', 'olti', 'yetti', 'sakkiz', "to'qqiz"];
const tens = ['', "o'n", 'yigirma', "o'ttiz", 'qirq', 'ellik', 'oltmish', 'yetmish', 'sakson', "to'qson"];

function readOption(name, fallback) {
  const prefix = `--${name}=`;
  const argument = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : fallback;
}

function numberToUzbek(value) {
  if (!Number.isInteger(value) || value < 1 || value > 999) {
    throw new Error(`Only integers from 1 to 999 are supported, received ${value}.`);
  }

  const parts = [];
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  if (hundreds) parts.push(ones[hundreds], 'yuz');
  const tensValue = Math.floor(remainder / 10);
  const onesValue = remainder % 10;
  if (tensValue) parts.push(tens[tensValue]);
  if (onesValue) parts.push(ones[onesValue]);
  return parts.join(' ');
}

function phraseForNumber(value) {
  return `Buyurtma raqami ${numberToUzbek(value)} tayyor.`;
}

function wavDurationMs(buffer) {
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF') return null;
  const byteRate = buffer.readUInt32LE(28);
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    if (chunkId === 'data' && byteRate) return Math.round((chunkSize / byteRate) * 1000);
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  return null;
}

async function fileExists(filePath) {
  try {
    return (await stat(filePath)).size > 100;
  } catch {
    return false;
  }
}

async function synthesize({ token, text, speaker }) {
  if (!token) throw new Error('MUXLISA_API_TOKEN is required when an audio source needs to be synthesized.');

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': token },
      body: JSON.stringify({ text, speaker }),
    });

    if (response.ok) return Buffer.from(await response.arrayBuffer());
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === MAX_ATTEMPTS) {
      throw new Error(`Muxlisa TTS failed with HTTP ${response.status}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 2500));
  }
  throw new Error('Muxlisa TTS retry limit was reached.');
}

function runFfmpeg(args, input) {
  if (!ffmpegPath) throw new Error('ffmpeg-static does not provide a binary for this platform.');

  return new Promise((resolve, reject) => {
    const process = spawn(ffmpegPath, ['-hide_banner', '-loglevel', 'error', ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const output = [];
    const errors = [];
    process.stdout.on('data', (chunk) => output.push(chunk));
    process.stderr.on('data', (chunk) => errors.push(chunk));
    process.on('error', reject);
    process.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(output));
      else reject(new Error(`MP3 encoding failed (${code}): ${Buffer.concat(errors).toString('utf8').trim()}`));
    });
    process.stdin.end(input);
  });
}

function encodeMp3(wavAudio) {
  return runFfmpeg(
    [
      '-f',
      'wav',
      '-i',
      'pipe:0',
      '-vn',
      '-ac',
      '1',
      '-ar',
      '24000',
      '-codec:a',
      'libmp3lame',
      '-b:a',
      '64k',
      '-f',
      'mp3',
      'pipe:1',
    ],
    wavAudio,
  );
}

async function readExistingManifest(outputDirectory) {
  try {
    const manifest = JSON.parse(await readFile(path.join(outputDirectory, 'manifest.json'), 'utf8'));
    return new Map(manifest.entries.map((entry) => [entry.key ?? entry.number ?? 'generic', entry]));
  } catch {
    return new Map();
  }
}

async function main() {
  const token = process.env.MUXLISA_API_TOKEN?.trim();

  const from = Number(readOption('from', '1'));
  const to = Number(readOption('to', '200'));
  const speaker = Number(readOption('speaker', '0'));
  const outputDirectory = path.resolve(readOption('output', DEFAULT_OUTPUT));
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > 999 || from > to) {
    throw new Error('Use a valid --from/--to range between 1 and 999.');
  }
  if (![0, 1].includes(speaker)) throw new Error('--speaker must be 0 (female) or 1 (male).');

  await mkdir(outputDirectory, { recursive: true });
  const existingManifest = await readExistingManifest(outputDirectory);
  const durationByKey = new Map([...existingManifest].map(([key, entry]) => [key, entry.durationMs ?? null]));
  const targets = [
    {
      key: 'unlock',
      fileName: 'unlock.mp3',
      text: 'Ovozli e’lonlar yoqildi.',
    },
    { key: 'generic', fileName: 'generic.mp3', legacyFileName: 'generic.wav', text: 'Buyurtmangiz tayyor.' },
    ...Array.from({ length: to - from + 1 }, (_, index) => {
      const number = from + index;
      return {
        key: number,
        fileName: `${number}.mp3`,
        legacyFileName: `${number}.wav`,
        text: phraseForNumber(number),
        number,
      };
    }),
  ];

  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    const filePath = path.join(outputDirectory, target.fileName);
    const audioTextChanged = existingManifest.get(target.key)?.text !== target.text;
    if (!(await fileExists(filePath)) || audioTextChanged) {
      const legacyFilePath = target.legacyFileName ? path.join(outputDirectory, target.legacyFileName) : null;
      const hasLegacySource = legacyFilePath ? await fileExists(legacyFilePath) : false;
      const wavAudio = hasLegacySource
        ? await readFile(legacyFilePath)
        : await synthesize({ token, text: target.text, speaker });
      durationByKey.set(target.key, wavDurationMs(wavAudio));
      await writeFile(filePath, await encodeMp3(wavAudio));
      process.stdout.write(
        `${hasLegacySource ? 'converted' : 'generated'} ${target.fileName} (${index + 1}/${targets.length})\n`,
      );
      if (!hasLegacySource && index < targets.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, REQUEST_INTERVAL_MS));
      }
    } else {
      process.stdout.write(`kept ${target.fileName} (${index + 1}/${targets.length})\n`);
    }
  }

  const manifestEntries = [];
  for (const target of targets) {
    const audio = await readFile(path.join(outputDirectory, target.fileName));
    manifestEntries.push({
      key: target.key,
      number: target.number ?? null,
      file: target.fileName,
      text: target.text,
      durationMs: durationByKey.get(target.key) ?? null,
      bytes: audio.length,
      sha256: createHash('sha256').update(audio).digest('hex'),
    });
  }
  await writeFile(
    path.join(outputDirectory, 'manifest.json'),
    `${JSON.stringify({ version: 3, locale: 'uz', speaker, format: 'audio/mpeg', bitrateKbps: 64, entries: manifestEntries }, null, 2)}\n`,
  );
  process.stdout.write(`manifest written with ${manifestEntries.length} files\n`);
}

await main();
