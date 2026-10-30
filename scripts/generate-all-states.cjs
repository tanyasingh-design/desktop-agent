const { Jimp } = require('jimp');
const fs = require('fs');
const path = require('path');

// Flood-fill alpha transparency from cell edges
function extractCell(sheet, cellBox, gridW = 64) {
  const { minX, minY, maxX, maxY } = cellBox;
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;

  // Crop cell from sheet
  const cell = sheet.clone().crop({ x: minX, y: minY, w, h });
  const data = cell.bitmap.data;

  function isBackground(r, g, b) {
    return r > 238 && g > 238 && b > 238;
  }

  // BFS flood fill from edges
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

    if (isBackground(r, g, b)) {
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

  // Now sample cell on a grid of gridW x gridH
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

      if (a < 50) continue; // transparent

      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
      pixels.push([gx, gy, hex]);
    }
  }

  return { width: gridW, height: gridH, pixels };
}

async function extractWalkSprite(walkPath) {
  const img = await Jimp.read(walkPath);
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  const data = img.bitmap.data;

  function isBg(r, g, b) {
    const avg = (r + g + b) / 3;
    const diff = Math.max(r, g, b) - Math.min(r, g, b);
    return avg > 170 && diff < 30;
  }

  const visited = new Uint8Array(w * h);
  const queue = [];

  for (let x = 0; x < w; x++) {
    queue.push(x, 0); queue.push(x, h - 1);
    visited[x] = 1; visited[(h - 1) * w + x] = 1;
  }
  for (let y = 1; y < h - 1; y++) {
    queue.push(0, y); queue.push(w - 1, y);
    visited[y * w] = 1; visited[y * w + (w - 1)] = 1;
  }

  let head = 0;
  while (head < queue.length) {
    const x = queue[head++];
    const y = queue[head++];
    const idx = (y * w + x) * 4;
    if (isBg(data[idx], data[idx + 1], data[idx + 2])) {
      data[idx + 3] = 0;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx >= 0 && nx < w && ny >= 0 && ny < h && !visited[ny * w + nx]) {
          visited[ny * w + nx] = 1;
          queue.push(nx, ny);
        }
      }
    }
  }

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

  img.crop({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
  const cw = img.bitmap.width;
  const ch = img.bitmap.height;
  const cdata = img.bitmap.data;

  const gridW = 64;
  const gridH = Math.round(ch * (gridW / cw));
  const pixels = [];

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const cx = Math.floor((gx + 0.5) * (cw / gridW));
      const cy = Math.floor((gy + 0.5) * (ch / gridH));
      const idx = (cy * cw + cx) * 4;
      if (cdata[idx + 3] < 50) continue;
      const hex = '#' + [cdata[idx], cdata[idx + 1], cdata[idx + 2]].map(v => v.toString(16).padStart(2, '0')).join('');
      pixels.push([gx, gy, hex]);
    }
  }

  return { width: gridW, height: gridH, pixels };
}

async function run() {
  const sheetPath = 'C:/Users/singh/.gemini/antigravity-ide/brain/fe54e47a-39a6-45a9-bea3-b7f1a7aa2b12/.user_uploaded/media_1793373360502.png';
  const walkPath = 'C:/Users/singh/.gemini/antigravity-ide/brain/fe54e47a-39a6-45a9-bea3-b7f1a7aa2b12/.user_uploaded/media_1793373049475.jpg';

  const sheet = await Jimp.read(sheetPath);

  // Exact bounding boxes from inspection
  const cells = {
    idle: { minX: 21, minY: 48, maxX: 340, maxY: 431 },
    sleep: { minX: 341, minY: 85, maxX: 681, maxY: 431 },
    fly: { minX: 682, minY: 45, maxX: 1012, maxY: 431 },
    angry: { minX: 22, minY: 512, maxX: 340, maxY: 927 },
    sad: { minX: 341, minY: 563, maxX: 681, maxY: 943 },
    remind: { minX: 682, minY: 551, maxX: 1018, maxY: 933 }
  };

  const results = {};

  for (const [name, box] of Object.entries(cells)) {
    console.log(`Processing state: ${name}...`);
    results[name] = extractCell(sheet, box, 64);
    console.log(`State ${name}: ${results[name].width}x${results[name].height}, ${results[name].pixels.length} pixels`);
  }

  console.log('Processing walk state...');
  results['walk'] = await extractWalkSprite(walkPath);
  console.log(`State walk: ${results['walk'].width}x${results['walk'].height}, ${results['walk'].pixels.length} pixels`);

  let code = `/**
 * Pure Code-Generated Pixel Matrices for Desktop Agent
 * Extracted directly from user's full pixelated states sheet.
 * Includes: idle (NEUTRAL), sleep (SLEEPING), fly (FLYING), angry (ANGRY), sad (SAD), remind (REMINDER), and walk.
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
  console.log('Successfully updated src/renderer/lib/pixel-data.ts with all 7 pixel states!');
}

run().catch(console.error);
