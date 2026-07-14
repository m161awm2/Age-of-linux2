import Phaser from 'phaser';
import { IMAGE_ASSETS, UNIT_SHEETS } from '../assets/manifest';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload(): void {
    this.cameras.main.setBackgroundColor('#0d1815');
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const bar = this.add.graphics();
    const label = this.add.text(centerX, centerY - 34, '전장 에셋 불러오는 중…', {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: '18px', color: '#ecddad',
    }).setOrigin(.5);
    this.load.on('progress', (value: number) => {
      document.getElementById('loading-screen')?.style.setProperty('--loading-progress', `${Math.round(value * 100)}%`);
      bar.clear().fillStyle(0x2b3a30).fillRoundedRect(centerX - 160, centerY, 320, 12, 6)
        .fillStyle(0x9fc45a).fillRoundedRect(centerX - 160, centerY, 320 * value, 12, 6);
    });
    this.load.on('complete', () => { bar.destroy(); label.destroy(); });
    this.load.setBaseURL(import.meta.env.BASE_URL);
    IMAGE_ASSETS.forEach(({ key, file }) => this.load.image(key, file));
    this.load.audio('bgm', 'assets/audio/bgm.mp3');
    UNIT_SHEETS.forEach((asset) => this.load.spritesheet(asset.key, asset.file, {
      frameWidth: asset.frameWidth,
      frameHeight: asset.frameHeight,
    }));
  }

  create(): void {
    UNIT_SHEETS.forEach(({ key }) => {
      if (!this.anims.exists(`${key}-idle`)) {
        this.anims.create({ key: `${key}-idle`, frames: this.anims.generateFrameNumbers(key, { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: `${key}-move`, frames: this.anims.generateFrameNumbers(key, { start: 4, end: 7 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: `${key}-attack`, frames: this.anims.generateFrameNumbers(key, { start: 8, end: 11 }), frameRate: 8, repeat: 0 });
      }
    });
    const loadingScreen = document.getElementById('loading-screen');
    loadingScreen?.classList.add('loading-complete');
    window.setTimeout(() => loadingScreen?.remove(), 450);
    this.scene.start('StartScene');
  }
}
