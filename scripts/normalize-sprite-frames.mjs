import { readdir, rename } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const unitDirectory = path.resolve(process.env.SPRITE_SOURCE_DIR ?? 'public/assets/units');
const columns = 4;
const rows = 3;
const sourceFrameWidth = 362;
const sourceFrameHeight = 362;
const frameWidth = 496;
const frameHeight = 400;
// 모든 유닛이 오른쪽을 바라보므로 긴 창과 검을 위한 전방 여백을 더 둔다.
// 런타임에서는 고정 frameOffsetX로 이 발 기준점을 컨테이너 중앙에 맞춘다.
const targetAnchorX = 204;
const targetBaselineY = frameHeight - 1;
const alphaThreshold = 32;
const dryRun = process.argv.includes('--dry-run');
const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const findLargestFrameComponent = (data, sheetWidth, column, row) => {
  const visited = new Uint8Array(frameWidth * frameHeight);
  let largest = null;
  for (let y = 0; y < frameHeight; y += 1) {
    for (let x = 0; x < frameWidth; x += 1) {
      const local = y * frameWidth + x;
      const source = (((row * frameHeight) + y) * sheetWidth + column * frameWidth + x) * 4;
      if (visited[local] || data[source + 3] <= alphaThreshold) continue;
      const queue = [local];
      let queueIndex = 0;
      let pixels = 0;
      let maxY = y;
      visited[local] = 1;
      while (queueIndex < queue.length) {
        const current = queue[queueIndex++];
        const currentX = current % frameWidth;
        const currentY = Math.floor(current / frameWidth);
        pixels += 1;
        maxY = Math.max(maxY, currentY);
        for (const [dx, dy] of neighbors) {
          const nextX = currentX + dx;
          const nextY = currentY + dy;
          if (nextX < 0 || nextX >= frameWidth || nextY < 0 || nextY >= frameHeight) continue;
          const next = nextY * frameWidth + nextX;
          const nextSource = (((row * frameHeight) + nextY) * sheetWidth + column * frameWidth + nextX) * 4;
          if (visited[next] || data[nextSource + 3] <= alphaThreshold) continue;
          visited[next] = 1;
          queue.push(next);
        }
      }
      if (!largest || pixels > largest.pixels) largest = { pixels, maxY };
    }
  }
  return largest;
};

const distanceBetweenBounds = (first, second) => {
  const dx = Math.max(first.minX - second.maxX, second.minX - first.maxX, 0);
  const dy = Math.max(first.minY - second.maxY, second.minY - first.maxY, 0);
  return Math.hypot(dx, dy);
};

const getAnchorX = (component) => {
  const lowerStart = component.maxY - Math.round((component.maxY - component.minY) * .28);
  let sum = 0;
  let count = 0;
  for (const pixel of component.pixels) {
    const x = pixel % (sourceFrameWidth * columns);
    const y = Math.floor(pixel / (sourceFrameWidth * columns));
    if (y < lowerStart) continue;
    sum += x;
    count += 1;
  }
  return count > 0 ? sum / count : (component.minX + component.maxX) / 2;
};

const getGroupLayout = (group) => {
  const minX = Math.min(...group.map((component) => component.minX));
  const maxX = Math.max(...group.map((component) => component.maxX));
  const minY = Math.min(...group.map((component) => component.minY));
  const maxY = Math.max(...group.map((component) => component.maxY));
  const lowerStart = maxY - Math.round((maxY - minY) * .28);
  let sum = 0;
  let count = 0;
  for (const component of group) {
    for (const pixel of component.pixels) {
      const x = pixel % (sourceFrameWidth * columns);
      const y = Math.floor(pixel / (sourceFrameWidth * columns));
      if (y < lowerStart) continue;
      sum += x;
      count += 1;
    }
  }
  return { minX, maxX, minY, maxY, anchorX: count > 0 ? sum / count : (minX + maxX) / 2 };
};

const findComponents = (data, sheetWidth, row) => {
  const rowY = row * sourceFrameHeight;
  const visited = new Uint8Array(sheetWidth * sourceFrameHeight);
  const components = [];

  for (let y = 0; y < sourceFrameHeight; y += 1) {
    for (let x = 0; x < sheetWidth; x += 1) {
      const local = y * sheetWidth + x;
      const source = ((rowY + y) * sheetWidth + x) * 4;
      if (visited[local] || data[source + 3] <= alphaThreshold) continue;

      const pixels = [];
      const queue = [local];
      let queueIndex = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      visited[local] = 1;

      while (queueIndex < queue.length) {
        const current = queue[queueIndex++];
        const currentX = current % sheetWidth;
        const currentY = Math.floor(current / sheetWidth);
        pixels.push(current);
        minX = Math.min(minX, currentX);
        maxX = Math.max(maxX, currentX);
        minY = Math.min(minY, currentY);
        maxY = Math.max(maxY, currentY);

        for (const [dx, dy] of neighbors) {
          const nextX = currentX + dx;
          const nextY = currentY + dy;
          if (nextX < 0 || nextX >= sheetWidth || nextY < 0 || nextY >= sourceFrameHeight) continue;
          const next = nextY * sheetWidth + nextX;
          const nextSource = ((rowY + nextY) * sheetWidth + nextX) * 4;
          if (visited[next] || data[nextSource + 3] <= alphaThreshold) continue;
          visited[next] = 1;
          queue.push(next);
        }
      }
      components.push({ pixels, minX, maxX, minY, maxY });
    }
  }
  return components;
};

for (const name of (await readdir(unitDirectory)).filter((file) => file.endsWith('.png')).sort()) {
  const file = path.join(unitDirectory, name);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width === frameWidth * columns && info.height === frameHeight * rows) {
    for (let frame = 0; frame < columns * rows; frame += 1) {
      const column = frame % columns;
      const row = Math.floor(frame / columns);
      let minX = frameWidth;
      let maxX = -1;
      let minY = frameHeight;
      let maxY = -1;
      for (let y = 0; y < frameHeight; y += 1) {
        for (let x = 0; x < frameWidth; x += 1) {
          const source = ((row * frameHeight + y) * info.width + column * frameWidth + x) * 4;
          if (data[source + 3] <= alphaThreshold) continue;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
      const lowerStart = maxY - Math.round((maxY - minY) * .28);
      let anchorSum = 0;
      let anchorPixels = 0;
      for (let y = lowerStart; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const source = ((row * frameHeight + y) * info.width + column * frameWidth + x) * 4;
          if (data[source + 3] <= alphaThreshold) continue;
          anchorSum += x;
          anchorPixels += 1;
        }
      }
      const anchorX = anchorSum / anchorPixels;
      const body = findLargestFrameComponent(data, info.width, column, row);
      if (!body || minX <= 0 || maxX >= frameWidth - 1 || maxY !== targetBaselineY ||
          body.maxY !== targetBaselineY || Math.abs(anchorX - targetAnchorX) > 1) {
        throw new Error(`${name} frame ${frame}: 정규화 검증 실패 [${minX}-${maxX}], ` +
          `anchor=${anchorX.toFixed(1)}, baseline=${maxY}, bodyBaseline=${body?.maxY ?? '없음'}`);
      }
    }
    console.log(`${name}\t${info.width}×${info.height}\t정규화 검증 완료`);
    continue;
  }
  if (info.width !== sourceFrameWidth * columns || info.height !== sourceFrameHeight * rows) {
    throw new Error(`${name}: 원본 크기는 ${sourceFrameWidth * columns}×${sourceFrameHeight * rows}여야 합니다. 현재 ${info.width}×${info.height}`);
  }

  const outputWidth = frameWidth * columns;
  const outputHeight = frameHeight * rows;
  const output = Buffer.alloc(outputWidth * outputHeight * 4);
  const reports = [];

  for (let row = 0; row < rows; row += 1) {
    const components = findComponents(data, info.width, row);
    const bodies = components
      .filter((component) => component.pixels.length >= 500)
      .sort((first, second) => second.pixels.length - first.pixels.length)
      .slice(0, columns)
      .map((component) => ({ ...component, anchorX: getAnchorX(component) }))
      .sort((first, second) => first.anchorX - second.anchorX);

    if (bodies.length !== columns) {
      throw new Error(`${name} row ${row}: 캐릭터 본체 ${columns}개를 찾지 못했습니다. (${bodies.length}개)`);
    }

    const groups = bodies.map((body) => [body]);
    for (const component of components) {
      if (bodies.some((body) => body.pixels === component.pixels)) continue;
      if (component.pixels.length < 3) continue;
      let closest = 0;
      let closestDistance = Number.POSITIVE_INFINITY;
      bodies.forEach((body, index) => {
        const distance = distanceBetweenBounds(component, body);
        if (distance < closestDistance) {
          closest = index;
          closestDistance = distance;
        }
      });
      // 본체의 발보다 아래에 완전히 떨어진 조각은 인접 프레임에서 넘어온 잔상이다.
      // 이를 포함하면 조각이 기준선이 되거나 본체 정렬 후 캔버스 밖으로 밀린다.
      if (closestDistance <= sourceFrameWidth * .45 && component.maxY <= bodies[closest].maxY) {
        groups[closest].push(component);
      }
    }

    groups.forEach((group, column) => {
      const body = bodies[column];
      const layout = getGroupLayout(group);
      const dx = Math.round(targetAnchorX - layout.anchorX);
      // 분리된 무기 끝이나 효과 조각이 본체보다 아래에 있을 수 있으므로,
      // 전체 그룹이 아니라 가장 큰 본체의 발 위치를 지면 기준으로 맞춘다.
      const dy = targetBaselineY - body.maxY;
      let minOutputX = frameWidth;
      let maxOutputX = -1;
      let minOutputY = frameHeight;
      let maxOutputY = -1;

      for (const component of group) {
        for (const pixel of component.pixels) {
          const sourceX = pixel % info.width;
          const sourceY = Math.floor(pixel / info.width);
          const destinationX = sourceX + dx;
          const destinationY = sourceY + dy;
          if (destinationX < 0 || destinationX >= frameWidth || destinationY < 0 || destinationY >= frameHeight) {
            throw new Error(`${name} frame ${row * columns + column}: ${destinationX},${destinationY}에서 픽셀이 잘립니다. ` +
              `body=[${body.minX},${body.minY}]-[${body.maxX},${body.maxY}], component=${component.pixels.length}px ` +
              `[${component.minX},${component.minY}]-[${component.maxX},${component.maxY}], ` +
              `anchor=${layout.anchorX.toFixed(1)}, dx=${dx}`);
          }
          const source = (((row * sourceFrameHeight) + sourceY) * info.width + sourceX) * 4;
          const destination = (((row * frameHeight) + destinationY) * outputWidth + column * frameWidth + destinationX) * 4;
          data.copy(output, destination, source, source + 4);
          minOutputX = Math.min(minOutputX, destinationX);
          maxOutputX = Math.max(maxOutputX, destinationX);
          minOutputY = Math.min(minOutputY, destinationY);
          maxOutputY = Math.max(maxOutputY, destinationY);
        }
      }
      reports.push(`${row * columns + column}:[${minOutputX},${minOutputY}]-[${maxOutputX},${maxOutputY}]`);
    });
  }

  console.log(`${name}\t${info.width}×${info.height} → ${outputWidth}×${outputHeight}\t${reports.join(' ')}`);
  if (dryRun) continue;
  const temporary = `${file}.normalized.tmp.png`;
  await sharp(output, { raw: { width: outputWidth, height: outputHeight, channels: 4 } })
    .png({ compressionLevel: 9 }).toFile(temporary);
  await rename(temporary, file);
}
