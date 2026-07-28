import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const projectDirectory = process.cwd();
const outputDirectory = path.join(projectDirectory, 'dist');
const serviceWorkerPath = path.join(outputDirectory, 'sw.js');
const manifestToken = '/* __PRECACHE_MANIFEST__ */';
const hashToken = '__BUILD_HASH__';

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(absolutePath) : [absolutePath];
    }),
  );
  return files.flat();
}

function toPublicUrl(absolutePath) {
  const relativePath = path.relative(outputDirectory, absolutePath).split(path.sep).join('/');
  return `/${relativePath
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')}`;
}

function shouldPrecache(absolutePath) {
  const url = toPublicUrl(absolutePath);
  return (
    url === '/index.html' ||
    url === '/manifest.webmanifest' ||
    url === '/favicon.png' ||
    url === '/favicon.svg' ||
    url === '/pos-auth-bg-source.png' ||
    url.startsWith('/assets/') ||
    url.startsWith('/icons/')
  );
}

const outputFiles = (await listFiles(outputDirectory))
  .filter((file) => file !== serviceWorkerPath && !file.endsWith('.map'))
  .filter(shouldPrecache)
  .sort();

if (outputFiles.length === 0) {
  throw new Error('No build output was found for the POS offline cache.');
}

const serviceWorkerTemplate = await readFile(serviceWorkerPath, 'utf8');
const buildHash = createHash('sha256');
buildHash.update(serviceWorkerTemplate);
for (const file of outputFiles) {
  buildHash.update(toPublicUrl(file));
  buildHash.update(await readFile(file));
}

const cacheVersion = buildHash.digest('hex').slice(0, 16);
const precacheManifest = outputFiles.map(toPublicUrl).map((url) => JSON.stringify(url)).join(',\n  ');

if (!serviceWorkerTemplate.includes(manifestToken) || !serviceWorkerTemplate.includes(hashToken)) {
  throw new Error('Service worker injection tokens are missing.');
}

const generatedServiceWorker = serviceWorkerTemplate
  .replace(manifestToken, precacheManifest)
  .replaceAll(hashToken, cacheVersion);

await writeFile(serviceWorkerPath, generatedServiceWorker);
console.log(`Injected ${outputFiles.length} files into POS offline cache ${cacheVersion}.`);
