const { Jimp } = require('jimp');
const fs = require('fs');
const path = require('path');

async function extractSpritePixels(filePath, name) {
  const img = await Jimp.read(filePath);
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  const data = img.bitmap.data;

  // Let's use 64 grid width for sharp, detailed pixel representation
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

      if (a < 50) continue; // transparent

      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Clean hex code
      const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
      pixels.push([gx, gy, hex]);
    }
  }

  console.log(`Sprite ${name}: ${gridW}x${gridH}, ${pixels.length} active pixels`);
  return { width: gridW, height: gridH, pixels };
}

async function run() {
  const spriteFiles = [
    { key: 'idle', file: 'd:/demo/desktop-agent/src/renderer/assets/sprites/idle.png' },
    { key: 'fly', file: 'd:/demo/desktop-agent/src/renderer/assets/sprites/fly.png' },
    { key: 'sleep', file: 'd:/demo/desktop-agent/src/renderer/assets/sprites/sleep.png' },
    { key: 'snack', file: 'd:/demo/desktop-agent/src/renderer/assets/sprites/snack.png' },
    { key: 'remind', file: 'd:/demo/desktop-agent/src/renderer/assets/sprites/remind.png' }
  ];

  const results = {};
  for (const s of spriteFiles) {
    results[s.key] = await extractSpritePixels(s.file, s.key);
  }

  // Create TypeScript file
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
  console.log('Successfully generated src/renderer/lib/pixel-data.ts!');
}

run().catch(console.error);
