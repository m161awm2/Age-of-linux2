import { readdir, rename } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const unitDirectory = path.resolve('public/assets/units');
const columns = 4;
const rows = 3;

for (const name of (await readdir(unitDirectory)).filter((file) => file.endsWith('.png')).sort()) {
  const file = path.join(unitDirectory, name);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const frameWidth = info.width / columns;
  const frameHeight = info.height / rows;
  if (!Number.isInteger(frameWidth) || !Number.isInteger(frameHeight)) throw new Error(`${name}: 4×3 프레임으로 나눌 수 없습니다.`);

  const output = Buffer.alloc(data.length);
  const targetCenterX = Math.floor(frameWidth / 2);
  const targetBaselineY = frameHeight - 22;
  const shifts = [];

  for (let frame = 0; frame < columns * rows; frame += 1) {
    const column = frame % columns;
    const row = Math.floor(frame / columns);
    let minX = frameWidth;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < frameHeight; y += 1) {
      for (let x = 0; x < frameWidth; x += 1) {
        const source = ((row * frameHeight + y) * info.width + column * frameWidth + x) * 4;
        if (data[source + 3] > 32) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    if (maxX < 0) continue;

    const centerX = (minX + maxX) / 2;
    const dx = Math.round(targetCenterX - centerX);
    const dy = Math.round(targetBaselineY - maxY);
    shifts.push(`${frame}:${dx >= 0 ? '+' : ''}${dx},${dy >= 0 ? '+' : ''}${dy}`);

    for (let y = 0; y < frameHeight; y += 1) {
      for (let x = 0; x < frameWidth; x += 1) {
        const destinationX = x + dx;
        const destinationY = y + dy;
        if (destinationX < 0 || destinationX >= frameWidth || destinationY < 0 || destinationY >= frameHeight) continue;
        const source = ((row * frameHeight + y) * info.width + column * frameWidth + x) * 4;
        const destination = ((row * frameHeight + destinationY) * info.width + column * frameWidth + destinationX) * 4;
        data.copy(output, destination, source, source + 4);
      }
    }
  }

  const temporary = `${file}.normalized.tmp.png`;
  await sharp(output, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ compressionLevel: 9 }).toFile(temporary);
  await rename(temporary, file);
  console.log(`${name}\t${frameWidth}×${frameHeight}\t${shifts.join(' ')}`);
}
