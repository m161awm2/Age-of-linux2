import { readdir, rename } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const assetRoot = path.resolve('public/assets');
const transparentDirectories = ['units', 'bases', 'branding', 'backgrounds'];
const opaqueFiles = new Set([path.join(assetRoot, 'backgrounds', 'sky.png')]);

const isBackgroundCandidate = (r, g, b) => {
  const minimum = Math.min(r, g, b);
  const maximum = Math.max(r, g, b);
  return minimum >= 205 && maximum - minimum <= 22;
};

async function listTargets() {
  const targets = [];
  for (const directory of transparentDirectories) {
    const fullDirectory = path.join(assetRoot, directory);
    for (const name of await readdir(fullDirectory)) {
      const file = path.join(fullDirectory, name);
      if (name.endsWith('.png') && !opaqueFiles.has(file)) targets.push(file);
    }
  }
  return targets.sort();
}

async function removeConnectedBackground(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const pixelCount = width * height;
  const transparent = new Uint8Array(pixelCount);
  const queued = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;

  const candidate = (index) => {
    const offset = index * channels;
    return data[offset + 3] > 0 && isBackgroundCandidate(data[offset], data[offset + 1], data[offset + 2]);
  };
  const enqueue = (index) => {
    if (!queued[index] && candidate(index)) {
      queued[index] = 1;
      queue[tail++] = index;
    }
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    transparent[index] = 1;
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);
  }

  // 로고의 글자 사이와 목재 기지의 창처럼 외곽에서 단절된 큰 체크무늬 영역도 제거한다.
  const shouldRemoveInterior = file.includes(`${path.sep}branding${path.sep}`) || file.includes(`${path.sep}bases${path.sep}`);
  if (shouldRemoveInterior) {
    const componentSeen = new Uint8Array(pixelCount);
    const component = new Int32Array(pixelCount);
    for (let start = 0; start < pixelCount; start += 1) {
      if (componentSeen[start] || transparent[start] || !candidate(start)) continue;
      let componentHead = 0;
      let componentTail = 0;
      let minX = width;
      let minY = height;
      let maxX = 0;
      let maxY = 0;
      componentSeen[start] = 1;
      component[componentTail++] = start;
      while (componentHead < componentTail) {
        const index = component[componentHead++];
        const x = index % width;
        const y = Math.floor(index / width);
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        const neighbors = [x > 0 ? index - 1 : -1, x + 1 < width ? index + 1 : -1, y > 0 ? index - width : -1, y + 1 < height ? index + width : -1];
        for (const neighbor of neighbors) {
          if (neighbor >= 0 && !componentSeen[neighbor] && !transparent[neighbor] && candidate(neighbor)) {
            componentSeen[neighbor] = 1;
            component[componentTail++] = neighbor;
          }
        }
      }
      const isBranding = file.includes(`${path.sep}branding${path.sep}`);
      const overlapsPenguin = minX < 450 && maxX > 320 && minY < 320 && maxY > 160;
      const removable = isBranding ? componentTail > 300 && !overlapsPenguin : componentTail > 500;
      if (removable) {
        for (let i = 0; i < componentTail; i += 1) transparent[component[i]] = 1;
      }
    }
  }

  const rgba = Buffer.alloc(pixelCount * 4);
  let removed = 0;
  for (let index = 0; index < pixelCount; index += 1) {
    const source = index * channels;
    const target = index * 4;
    rgba[target] = data[source];
    rgba[target + 1] = data[source + 1];
    rgba[target + 2] = data[source + 2];
    rgba[target + 3] = transparent[index] ? 0 : data[source + 3];
    if (transparent[index]) removed += 1;
  }

  // 한 픽셀짜리 부드러운 매트로 흰 테두리만 줄이고 원본 내부 픽셀은 보존한다.
  for (let index = 0; index < pixelCount; index += 1) {
    if (transparent[index]) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    const touchesTransparency =
      (x > 0 && transparent[index - 1]) ||
      (x + 1 < width && transparent[index + 1]) ||
      (y > 0 && transparent[index - width]) ||
      (y + 1 < height && transparent[index + width]);
    if (!touchesTransparency) continue;
    const target = index * 4;
    const minimum = Math.min(rgba[target], rgba[target + 1], rgba[target + 2]);
    const maximum = Math.max(rgba[target], rgba[target + 1], rgba[target + 2]);
    if (minimum >= 175 && maximum - minimum <= 34) {
      rgba[target + 3] = Math.round(Math.max(0, Math.min(255, ((255 - minimum) / 80) * 255)));
    }
  }

  const temporary = `${file}.transparent.tmp.png`;
  await sharp(rgba, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 9 }).toFile(temporary);
  await rename(temporary, file);
  return { width, height, removed, coverage: removed / pixelCount };
}

for (const file of await listTargets()) {
  const result = await removeConnectedBackground(file);
  console.log(`${path.relative(assetRoot, file)}\t${result.width}x${result.height}\t투명 ${(result.coverage * 100).toFixed(1)}%`);
}
