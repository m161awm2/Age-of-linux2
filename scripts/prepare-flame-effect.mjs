import { mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

if (!process.argv[2]) throw new Error('사용법: node scripts/prepare-flame-effect.mjs <2프레임 화염 원본 PNG>');
const source = path.resolve(process.argv[2]);
const output = path.resolve('public/assets/effects/siphonarioi-flame.png');
const sourceFrameWidth = 1086;
const sourceFrameHeight = 724;
const frameWidth = 352;
const frameHeight = 176;
const padding = 8;

const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
if (info.width !== sourceFrameWidth * 2 || info.height !== sourceFrameHeight) {
  throw new Error(`화염 원본은 ${sourceFrameWidth * 2}×${sourceFrameHeight}여야 합니다. 현재 ${info.width}×${info.height}`);
}

const frames = [];
for (let frame = 0; frame < 2; frame += 1) {
  const rgba = Buffer.alloc(sourceFrameWidth * sourceFrameHeight * 4);
  let minX = sourceFrameWidth;
  let maxX = -1;
  let minY = sourceFrameHeight;
  let maxY = -1;

  for (let y = 0; y < sourceFrameHeight; y += 1) {
    for (let x = 0; x < sourceFrameWidth; x += 1) {
      const sourceOffset = (y * info.width + frame * sourceFrameWidth + x) * 4;
      const targetOffset = (y * sourceFrameWidth + x) * 4;
      const r = data[sourceOffset];
      const g = data[sourceOffset + 1];
      const b = data[sourceOffset + 2];
      const isCheckerboard = Math.min(r, g, b) >= 205 && Math.max(r, g, b) - Math.min(r, g, b) <= 22;
      rgba[targetOffset] = r;
      rgba[targetOffset + 1] = g;
      rgba[targetOffset + 2] = b;
      rgba[targetOffset + 3] = isCheckerboard ? 0 : data[sourceOffset + 3];
      if (!isCheckerboard && data[sourceOffset + 3] > 0) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) throw new Error(`화염 프레임 ${frame}이 비어 있습니다.`);
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  if (width + padding * 2 > frameWidth || height + padding * 2 > frameHeight) {
    throw new Error(`화염 프레임 ${frame}이 출력 캔버스보다 큽니다: ${width}×${height}`);
  }
  const cropped = await sharp(rgba, { raw: { width: sourceFrameWidth, height: sourceFrameHeight, channels: 4 } })
    .extract({ left: minX, top: minY, width, height })
    .png()
    .toBuffer();
  frames.push({ input: cropped, left: frame * frameWidth + padding, top: Math.round((frameHeight - height) / 2) });
}

await mkdir(path.dirname(output), { recursive: true });
const temporary = `${output}.tmp.png`;
await sharp({
  create: { width: frameWidth * 2, height: frameHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
}).composite(frames).png({ compressionLevel: 9 }).toFile(temporary);
await rename(temporary, output);
console.log(`${path.relative(process.cwd(), output)} 생성 완료 (${frameWidth * 2}×${frameHeight})`);
