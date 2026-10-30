const { Jimp } = require('jimp');
const fs = require('fs');
const path = require('path');

async function processImage(inputPath, outputPath) {
  const img = await Jimp.read(inputPath);
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  const data = img.bitmap.data;

  // Helper to get pixel at x, y
  function getPixel(x, y) {
    const idx = (y * w + x) * 4;
    return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
  }

  // Check if pixel is background checkerboard
  function isCheckerboard(r, g, b) {
    const avg = (r + g + b) / 3;
    const diff = Math.max(r, g, b) - Math.min(r, g, b);
    // Checkerboard squares are either light gray (~215-225) or white (~240-255)
    // Low saturation (diff < 30) and high brightness (avg > 175)
    return avg > 170 && diff < 30;
  }

  // Visited array
  const visited = new Uint8Array(w * h);
  const queue = [];

  // Seed with all perimeter pixels
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

  let transparentCount = 0;

  // BFS Queue
  let head = 0;
  while (head < queue.length) {
    const x = queue[head++];
    const y = queue[head++];
    const idx = (y * w + x) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];

    if (isCheckerboard(r, g, b)) {
      // Set to fully transparent
      data[idx + 3] = 0;
      transparentCount++;

      // Check 4 neighbors
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

  console.log(`Processed ${outputPath}: made ${transparentCount} pixels transparent out of ${w * h}`);

  // Find bounding box of non-transparent pixels to trim margins
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = data[(y * w + x) * 4 + 3];
      if (a > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  console.log(`Bounding box: (${minX}, ${minY}) to (${maxX}, ${maxY}) = ${maxX - minX + 1}x${maxY - minY + 1}`);

  // Add 16px padding
  const pad = 16;
  const cropX = Math.max(0, minX - pad);
  const cropY = Math.max(0, minY - pad);
  const cropW = Math.min(w - cropX, maxX - minX + 1 + pad * 2);
  const cropH = Math.min(h - cropY, maxY - minY + 1 + pad * 2);

  img.crop({ x: cropX, y: cropY, w: cropW, h: cropH });

  // Ensure output dir exists
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await img.write(outputPath);
  console.log(`Saved trimmed transparent sprite to ${outputPath}`);
}

async function run() {
  const base = 'C:/Users/singh/.gemini/antigravity-ide/brain/fe54e47a-39a6-45a9-bea3-b7f1a7aa2b12/.user_uploaded';
  const outDir = 'd:/demo/desktop-agent/src/renderer/assets/sprites';

  const sprites = [
    { file: 'media_1793370832964.jpg', name: 'idle.png' },
    { file: 'media_1793370833168.jpg', name: 'sleep.png' },
    { file: 'media_1793370833224.jpg', name: 'fly.png' },
    { file: 'media_1793370833289.jpg', name: 'snack.png' },
    { file: 'media_1793370833300.jpg', name: 'remind.png' }
  ];

  for (const s of sprites) {
    const src = path.join(base, s.file);
    const dest = path.join(outDir, s.name);
    await processImage(src, dest);
  }
}

run().catch(console.error);
