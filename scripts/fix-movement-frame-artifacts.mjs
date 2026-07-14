import { rename } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const frameWidth = 362;
const frameHeight = 362;
const targetCenterX = Math.floor(frameWidth / 2);
const targetBaselineY = frameHeight - 22;
const corrections = {
  'paladin.png': [4],
  'crusader.png': [4],
  'spartan.png': [4, 7],
  'knight.png': [4, 5, 6],
  'winged-hussar.png': [4, 5, 6, 7],
  'dragoon-ranged.png': [4, 6],
  'dragoon-melee.png': [4, 5, 6],
  'fenrir.png': [5, 6],
};

for (const [name, frames] of Object.entries(corrections)) {
  const file = path.resolve('public/assets/units', name);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== frameWidth * 4 || info.height !== frameHeight * 3) {
    throw new Error(`${name}: 예상한 4×3 스프라이트 시트 크기가 아닙니다.`);
  }
  const output = Buffer.from(data);

  for (const frame of frames) {
    const column = frame % 4;
    const row = Math.floor(frame / 4);
    const visited = new Uint8Array(frameWidth * frameHeight);
    const components = [];

    for (let y = 0; y < frameHeight; y += 1) {
      for (let x = 0; x < frameWidth; x += 1) {
        const localIndex = y * frameWidth + x;
        const sourceIndex = ((row * frameHeight + y) * info.width + column * frameWidth + x) * 4;
        if (visited[localIndex] || data[sourceIndex + 3] <= 32) continue;

        const queue = [[x, y]];
        let queueIndex = 0;
        let minX = x;
        let maxX = x;
        let minY = y;
        let maxY = y;
        visited[localIndex] = 1;
        while (queueIndex < queue.length) {
          const [currentX, currentY] = queue[queueIndex++];
          minX = Math.min(minX, currentX);
          maxX = Math.max(maxX, currentX);
          minY = Math.min(minY, currentY);
          maxY = Math.max(maxY, currentY);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nextX = currentX + dx;
            const nextY = currentY + dy;
            if (nextX < 0 || nextX >= frameWidth || nextY < 0 || nextY >= frameHeight) continue;
            const nextLocal = nextY * frameWidth + nextX;
            const nextSource = ((row * frameHeight + nextY) * info.width + column * frameWidth + nextX) * 4;
            if (visited[nextLocal] || data[nextSource + 3] <= 32) continue;
            visited[nextLocal] = 1;
            queue.push([nextX, nextY]);
          }
        }
        components.push({ size: queue.length, minX, maxX, minY, maxY });
      }
    }

    const body = components.sort((a, b) => b.size - a.size)[0];
    if (!body) continue;
    const bodyCenterX = (body.minX + body.maxX) / 2;
    const shiftX = Math.round(targetCenterX - bodyCenterX);
    const shiftY = targetBaselineY - body.maxY;

    for (let y = 0; y < frameHeight; y += 1) {
      const start = ((row * frameHeight + y) * info.width + column * frameWidth) * 4;
      output.fill(0, start, start + frameWidth * 4);
    }
    for (let y = body.minY; y <= body.maxY; y += 1) {
      for (let x = body.minX; x <= body.maxX; x += 1) {
        const destinationX = x + shiftX;
        const destinationY = y + shiftY;
        if (destinationX < 0 || destinationX >= frameWidth || destinationY < 0 || destinationY >= frameHeight) continue;
        const source = ((row * frameHeight + y) * info.width + column * frameWidth + x) * 4;
        const destination = ((row * frameHeight + destinationY) * info.width + column * frameWidth + destinationX) * 4;
        data.copy(output, destination, source, source + 4);
      }
    }
    console.log(`${name} frame ${frame}: 잔상 ${components.length - 1}개 제거, 위치 ${shiftX},${shiftY} 보정`);
  }

  const temporary = `${file}.artifact-fix.tmp.png`;
  await sharp(output, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ compressionLevel: 9 }).toFile(temporary);
  await rename(temporary, file);
}
