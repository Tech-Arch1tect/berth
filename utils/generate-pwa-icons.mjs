import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const outDir = join(dir, '..', 'public', 'pwa');
mkdirSync(outDir, { recursive: true });

const any = readFileSync(join(dir, 'icon.svg'));
const maskable = readFileSync(join(dir, 'icon-maskable.svg'));

const render = (svg, size, name) =>
  sharp(svg, { density: 384 }).resize(size, size).png().toFile(join(outDir, name));

await render(any, 192, 'icon-192.png');
await render(any, 512, 'icon-512.png');
await render(maskable, 192, 'icon-maskable-192.png');
await render(maskable, 512, 'icon-maskable-512.png');
await render(maskable, 180, 'apple-touch-icon-180.png');
await render(any, 48, 'favicon-48.png');
writeFileSync(join(outDir, 'favicon.svg'), any);
