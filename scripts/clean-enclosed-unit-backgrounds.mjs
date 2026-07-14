import { rename } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const targets = ['archer.png', 'chariot.png'];
const frameWidth = 362;
const frameHeight = 362;
const minimumComponentSize = 80;

const isBackgroundPixel = (data, index) => {
  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  return data[index + 3] > 0
    && Math.min(red, green, blue) >= 205
    && Math.max(red, green, blue) - Math.min(red, green, blue) <= 22;
};

for (const name of targets) {
  const file = path.resolve('public/assets/units', name);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const output = Buffer.from(data);
  let removed = 0;

  for (let frame = 0; frame < 12; frame += 1) {
    const column = frame % 4;
    const row = Math.floor(frame / 4);
    const visited = new Uint8Array(frameWidth * frameHeight);
    for (let y = 0; y < frameHeight; y += 1) {
      for (let x = 0; x < frameWidth; x += 1) {
        const local = y * frameWidth + x;
        const source = ((row * frameHeight + y) * info.width + column * frameWidth + x) * 4;
        if (visited[local] || !isBackgroundPixel(data, source)) continue;
        const queue = [[x, y]];
        let queueIndex = 0;
        visited[local] = 1;
        while (queueIndex < queue.length) {
          const [currentX, currentY] = queue[queueIndex++];
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nextX = currentX + dx;
            const nextY = currentY + dy;
            if (nextX < 0 || nextX >= frameWidth || nextY < 0 || nextY >= frameHeight) continue;
            const nextLocal = nextY * frameWidth + nextX;
            const nextSource = ((row * frameHeight + nextY) * info.width + column * frameWidth + nextX) * 4;
            if (visited[nextLocal] || !isBackgroundPixel(data, nextSource)) continue;
            visited[nextLocal] = 1;
            queue.push([nextX, nextY]);
          }
        }
        if (queue.length < minimumComponentSize) continue;
        for (const [removeX, removeY] of queue) {
          const target = ((row * frameHeight + removeY) * info.width + column * frameWidth + removeX) * 4;
          output[target + 3] = 0;
          removed += 1;
        }
      }
    }
  }

  const temporary = `${file}.enclosed-background.tmp.png`;
  await sharp(output, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ compressionLevel: 9 }).toFile(temporary);
  await rename(temporary, file);
  console.log(`${name}: 내부 배경 ${removed}픽셀 제거`);
}
