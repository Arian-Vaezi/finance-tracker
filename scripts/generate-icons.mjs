// Generates the PWA PNG icons (no external dependencies — pure Node + zlib).
// Draws the same gradient + ascending-bars motif as public/icon.svg.
//   npm run icons
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '..', 'public');

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const lerp = (a, b, t) => Math.round(a + (b - a) * t);

function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const f = size / 512;
  const bars = [
    { x: 150 * f, w: 46 * f, y: 300 * f, h: 78 * f },
    { x: 233 * f, w: 46 * f, y: 252 * f, h: 126 * f },
    { x: 316 * f, w: 46 * f, y: 196 * f, h: 182 * f },
  ];
  for (let y = 0; y < size; y++) {
    const t = y / (size - 1);
    const r = lerp(0x63, 0x43, t);
    const g = lerp(0x66, 0x38, t);
    const b = lerp(0xf1, 0xca, t);
    for (let x = 0; x < size; x++) {
      let [R, G, B] = [r, g, b];
      for (const bar of bars) {
        if (x >= bar.x && x < bar.x + bar.w && y >= bar.y && y < bar.y + bar.h) {
          R = G = B = 255;
          break;
        }
      }
      const i = (y * size + x) * 4;
      rgba[i] = R;
      rgba[i + 1] = G;
      rgba[i + 2] = B;
      rgba[i + 3] = 255;
    }
  }
  return encodePng(size, rgba);
}

mkdirSync(publicDir, { recursive: true });
writeFileSync(join(publicDir, 'pwa-512x512.png'), render(512));
writeFileSync(join(publicDir, 'pwa-192x192.png'), render(192));
writeFileSync(join(publicDir, 'apple-touch-icon.png'), render(180));
console.log('✓ Generated PWA icons in public/ (192, 512, apple-touch-icon).');
