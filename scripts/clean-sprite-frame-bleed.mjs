import { readdir, rename } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const unitDirectory = path.resolve('public/assets/units');
const columns = 4;
const rows = 3;
const dryRun = process.argv.includes('--dry-run');
const alphaThreshold = process.argv.includes('--all-alpha') ? 0 : 32;
const reportAll = process.argv.includes('--report-all');
if (reportAll && !dryRun) throw new Error('--report-all은 --dry-run과 함께만 사용할 수 있습니다.');

const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];

for (const name of (await readdir(unitDirectory)).filter((file) => file.endsWith('.png')).sort()) {
  const file = path.join(unitDirectory, name);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const frameWidth = info.width / columns;
  const frameHeight = info.height / rows;
  if (!Number.isInteger(frameWidth) || !Number.isInteger(frameHeight)) {
    throw new Error(`${name}: 4×3 프레임으로 나눌 수 없습니다.`);
  }

  const output = Buffer.from(data);
  let removedComponents = 0;
  let removedPixels = 0;

  for (let frame = 0; frame < columns * rows; frame += 1) {
    const column = frame % columns;
    const row = Math.floor(frame / columns);
    const visited = new Uint8Array(frameWidth * frameHeight);
    const components = [];

    for (let y = 0; y < frameHeight; y += 1) {
      for (let x = 0; x < frameWidth; x += 1) {
        const localIndex = y * frameWidth + x;
        const source = ((row * frameHeight + y) * info.width + column * frameWidth + x) * 4;
        if (visited[localIndex] || data[source + 3] <= alphaThreshold) continue;

        const pixels = [];
        const queue = [[x, y]];
        let queueIndex = 0;
        let minX = x;
        let maxX = x;
        let minY = y;
        let maxY = y;
        visited[localIndex] = 1;

        while (queueIndex < queue.length) {
          const [currentX, currentY] = queue[queueIndex++];
          pixels.push(currentY * frameWidth + currentX);
          minX = Math.min(minX, currentX);
          maxX = Math.max(maxX, currentX);
          minY = Math.min(minY, currentY);
          maxY = Math.max(maxY, currentY);

          for (const [dx, dy] of neighbors) {
            const nextX = currentX + dx;
            const nextY = currentY + dy;
            if (nextX < 0 || nextX >= frameWidth || nextY < 0 || nextY >= frameHeight) continue;
            const nextLocal = nextY * frameWidth + nextX;
            const nextSource = ((row * frameHeight + nextY) * info.width + column * frameWidth + nextX) * 4;
            if (visited[nextLocal] || data[nextSource + 3] <= alphaThreshold) continue;
            visited[nextLocal] = 1;
            queue.push([nextX, nextY]);
          }
        }
        components.push({ pixels, minX, maxX, minY, maxY });
      }
    }

    const primary = components.reduce((largest, component) =>
      !largest || component.pixels.length > largest.pixels.length ? component : largest, null);
    if (!primary) continue;

    for (const component of components) {
      if (component === primary) continue;
      const touchesSide = component.minX === 0 || component.maxX === frameWidth - 1;
      const smallRelativeToUnit = component.pixels.length < primary.pixels.length * .12;
      const narrow = component.maxX - component.minX < frameWidth * .28;
      if ((!touchesSide && !reportAll) || !smallRelativeToUnit || !narrow) continue;

      removedComponents += 1;
      removedPixels += component.pixels.length;
      console.log(`${name}\tframe ${frame}\t${component.pixels.length}px\t` +
        `[${component.minX},${component.minY}]-[${component.maxX},${component.maxY}]`);
      if (dryRun) continue;

      // 임계값 아래의 안티앨리어싱 가장자리까지 함께 지우도록 요소의 경계 상자를
      // 한 픽셀 확장하되, 같은 상자 안의 주 캐릭터 픽셀은 보존한다.
      const componentPixels = new Set(component.pixels);
      for (let y = Math.max(0, component.minY - 1); y <= Math.min(frameHeight - 1, component.maxY + 1); y += 1) {
        for (let x = Math.max(0, component.minX - 1); x <= Math.min(frameWidth - 1, component.maxX + 1); x += 1) {
          const localIndex = y * frameWidth + x;
          const isComponentPixel = componentPixels.has(localIndex);
          const global = ((row * frameHeight + y) * info.width + column * frameWidth + x) * 4;
          if (isComponentPixel || output[global + 3] <= alphaThreshold) output.fill(0, global, global + 4);
        }
      }
    }
  }

  if (!dryRun && removedComponents > 0) {
    const temporary = `${file}.frame-bleed.tmp.png`;
    await sharp(output, { raw: { width: info.width, height: info.height, channels: 4 } })
      .png({ compressionLevel: 9 }).toFile(temporary);
    await rename(temporary, file);
  }
  if (removedComponents > 0) console.log(`${name}\t합계 ${removedComponents}개 요소, ${removedPixels}px`);
}
