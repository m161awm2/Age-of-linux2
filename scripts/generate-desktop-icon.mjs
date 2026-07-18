import sharp from 'sharp';

await sharp('build/profile-icon.png')
  .resize(1024, 1024, { fit: 'cover', position: 'centre' })
  .png()
  .toFile('build/icon.png');

console.log('Desktop icon generated from GitHub profile: build/icon.png');
