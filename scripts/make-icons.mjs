#!/usr/bin/env node
/**
 * Generate the extension's PNG icons.
 *
 * Written by hand rather than committing binaries or pulling in an image
 * library: the mark is simple (rounded brand-coloured square with three
 * ascending bars), and this keeps the dependency surface small for a product
 * that handles resumes.
 *
 * Usage: node scripts/make-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../apps/extension/public/icons');
const SIZES = [16, 32, 48, 128];

const BRAND = [59, 91, 219];
const WHITE = [255, 255, 255];

/** CRC-32, required by the PNG chunk format. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(width, height, rgba) {
  // Each scanline is prefixed with a filter byte (0 = none).
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Signed distance to a rounded rectangle, used for anti-aliased edges. */
function roundedRectSdf(px, py, halfW, halfH, radius) {
  const qx = Math.abs(px) - halfW + radius;
  const qy = Math.abs(py) - halfH + radius;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - radius;
}

function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const radius = size * 0.22;

  // Bars: x offset, width, height (all as fractions of the icon size).
  const bars = [
    { x: 0.26, w: 0.13, h: 0.24 },
    { x: 0.435, w: 0.13, h: 0.38 },
    { x: 0.61, w: 0.13, h: 0.52 },
  ];
  const barBottom = 0.74;

  // 3×3 supersampling keeps the small sizes legible.
  const SS = 3;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bgCoverage = 0;
      let fgCoverage = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;

          if (roundedRectSdf(px - c, py - c, c, c, radius) <= 0) bgCoverage++;

          const fx = px / size;
          const fy = py / size;
          for (const bar of bars) {
            if (fx >= bar.x && fx <= bar.x + bar.w && fy <= barBottom && fy >= barBottom - bar.h) {
              fgCoverage++;
              break;
            }
          }
        }
      }

      const samples = SS * SS;
      const bgA = bgCoverage / samples;
      const fgA = (fgCoverage / samples) * bgA;

      const i = (y * size + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        // Composite the white bars over the brand square.
        rgba[i + ch] = Math.round(BRAND[ch] * (1 - fgA / Math.max(bgA, 1e-6)) + WHITE[ch] * (fgA / Math.max(bgA, 1e-6)));
      }
      rgba[i + 3] = Math.round(bgA * 255);
    }
  }

  return encodePng(size, size, rgba);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const file = resolve(OUT_DIR, `icon-${size}.png`);
  writeFileSync(file, drawIcon(size));
  console.log(`wrote ${file}`);
}
