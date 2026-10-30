const { Jimp } = require('jimp');

async function inspect() {
  const img = await Jimp.read('C:/Users/singh/.gemini/antigravity-ide/brain/fe54e47a-39a6-45a9-bea3-b7f1a7aa2b12/.user_uploaded/media_1793370832964.jpg');
  console.log('Size:', img.bitmap.width, 'x', img.bitmap.height);
  for (let y = 0; y < 100; y += 20) {
    const row = [];
    for (let x = 0; x < 100; x += 20) {
      const color = img.getPixelColor(x, y);
      const r = (color >> 24) & 0xff;
      const g = (color >> 16) & 0xff;
      const b = (color >> 8) & 0xff;
      row.push(`(${r},${g},${b})`);
    }
    console.log(`y=${y}:`, row.join(' '));
  }
}

inspect().catch(console.error);
