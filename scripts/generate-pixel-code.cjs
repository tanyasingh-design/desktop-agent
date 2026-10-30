const { Jimp } = require('jimp');
const fs = require('fs');
const path = require('path');

// Flood-fill alpha transparency from border edges
function removeCheckerboard(img) {
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  const data = img.bitmap.data;

  function isCheckerboard(r, g, b) {
    const avg = (r + g + b) / 3;
    const diff = Math.max(r, g, b) - Math.min(r, g, b);
    return avg > 170 && diff < 30;
  }

  const visited = new Uint8Array(w * h);
  const queue = [];

  for (let x = 0; x < w; x++) {
    queue.push(x, 0);
    queue.push(x, h - 1);
    visited[x] = 1;
    visited[(h - 1) * w + x] = 1;
  }
  for (let y = 1; y < h - 1; y++) {
    queue.push(0, y);
    queue.push(w - 1, y);
    visited[y * w] = 1;
    visited[y * w + (w - 1)] = 1;
  }

  let head = 0;
  while (head < queue.length) {
    const x = queue[head++];
    const y = queue[head++];
    const idx = (y * w + x) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];

    if (isCheckerboard(r, g, b)) {
      data[idx + 3] = 0; // Alpha transparent

      const neighbors = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1]
      ];

      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          const nPos = ny * w + nx;
          if (!visited[nPos]) {
            visited[nPos] = 1;
            queue.push(nx, ny);
          }
        }
      }
    }
  }

  // Find bounding box
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const pad = 12;
  const cropX = Math.max(0, minX - pad);
  const cropY = Math.max(0, minY - pad);
  const cropW = Math.min(w - cropX, maxX - minX + 1 + pad * 2);
  const cropH = Math.min(h - cropY, maxY - minY + 1 + pad * 2);

  img.crop({ x: cropX, y: cropY, w: cropW, h: cropH });
}

async function extractSpritePixels(jpgPath, name) {
  const img = await Jimp.read(jpgPath);
  removeCheckerboard(img);

  const w = img.bitmap.width;
  const h = img.bitmap.height;
  const data = img.bitmap.data;

  const gridW = 64;
  const gridH = Math.round(h * (gridW / w));
  const cellW = w / gridW;
  const cellH = h / gridH;

  const pixels = [];

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const cx = Math.floor((gx + 0.5) * cellW);
      const cy = Math.floor((gy + 0.5) * cellH);
      const idx = (cy * w + cx) * 4;
      const a = data[idx + 3];

      if (a < 50) continue;

      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
      pixels.push([gx, gy, hex]);
    }
  }

  console.log(`Sprite ${name}: ${gridW}x${gridH}, ${pixels.length} active pixels`);
  return { width: gridW, height: gridH, pixels };
}

async function run() {
  const base = 'C:/Users/singh/.gemini/antigravity-ide/brain/fe54e47a-39a6-45a9-bea3-b7f1a7aa2b12/.user_uploaded';

  const spriteFiles = [
    { key: 'idle', file: path.join(base, 'media_1793370832964.jpg') },
    { key: 'fly', file: path.join(base, 'media_1793370833224.jpg') },
    { key: 'sleep', file: path.join(base, 'media_1793370833168.jpg') },
    { key: 'snack', file: path.join(base, 'media_1793370833289.jpg') },
    { key: 'remind', file: path.join(base, 'media_1793370833300.jpg') },
    { key: 'walk', file: path.join(base, 'media_1793373049475.jpg') }
  ];

  const results = {};
  for (const s of spriteFiles) {
    results[s.key] = await extractSpritePixels(s.file, s.key);
  }

  let code = `/**
 * Pure Code-Generated Pixel Matrices for Desktop Agent
 * 100% drawn in code without external PNG assets.
 */

export interface PixelSpriteData {
  width: number
  height: number
  pixels: [number, number, string][] // [x, y, hexColor]
}

export const PIXEL_SPRITES: Record<string, PixelSpriteData> = {\n`;

  for (const [key, data] of Object.entries(results)) {
    code += `  ${key}: {\n    width: ${data.width},\n    height: ${data.height},\n    pixels: [\n`;
    for (let i = 0; i < data.pixels.length; i++) {
      const [x, y, hex] = data.pixels[i];
      code += `      [${x},${y},'${hex}'],\n`;
    }
    code += `    ]\n  },\n`;
  }

  code += `};\n`;

  fs.writeFileSync('d:/demo/desktop-agent/src/renderer/lib/pixel-data.ts', code);
  console.log('Successfully updated src/renderer/lib/pixel-data.ts with all 6 sprites including walk!');
}

run().catch(console.error);
