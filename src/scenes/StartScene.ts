import Phaser from 'phaser';
import { DIFFICULTIES } from '../data/constants';
import type { Difficulty } from '../data/types';

export class StartScene extends Phaser.Scene {
  constructor() { super('StartScene'); }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    this.add.image(width / 2, height / 2, 'sky').setDisplaySize(width, height);
    this.add.image(width / 2, height, 'hills').setOrigin(.5, 1).setDisplaySize(width, height);
    this.add.image(width / 2, height, 'ground').setOrigin(.5, 1).setDisplaySize(width, height);
    this.add.rectangle(width / 2, height / 2, width, height, 0x07120e, .42);

    const logo = this.add.image(width / 2, Math.max(145, height * .25), 'logo').setDisplaySize(Math.min(760, width * .75), Math.min(254, width * .25));
    this.add.text(width / 2, logo.y + logo.displayHeight * .48, '전직의 시대 · 브라우저 전장', {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: `${Math.min(25, width / 45)}px`,
      fontStyle: 'bold', color: '#f4e5a6', stroke: '#1d2116', strokeThickness: 5,
    }).setOrigin(.5);

    const difficulties: Difficulty[] = ['Easy', 'Medium', 'Hard'];
    const buttonY = Math.min(height - 190, height * .66);
    difficulties.forEach((difficulty, index) => {
      const x = width / 2 + (index - 1) * Math.min(210, width * .24);
      const config = DIFFICULTIES[difficulty];
      const button = this.add.rectangle(x, buttonY, Math.min(185, width * .21), 72, difficulty === 'Hard' ? 0x7f302d : 0x244a39, .96)
        .setStrokeStyle(2, difficulty === 'Hard' ? 0xe5966a : 0xb7d57a).setInteractive({ useHandCursor: true });
      this.add.text(x, buttonY - 10, config.label, { fontFamily: 'Pretendard, sans-serif', fontSize: '23px', fontStyle: 'bold', color: '#fff4d3' }).setOrigin(.5);
      this.add.text(x, buttonY + 17, `적 기지 ${config.enemyBaseHp} HP`, { fontFamily: 'Pretendard, sans-serif', fontSize: '13px', color: '#d7ddc5' }).setOrigin(.5);
      button.on('pointerover', () => button.setScale(1.04)).on('pointerout', () => button.setScale(1)).on('pointerdown', () => this.scene.start('GameScene', { difficulty }));
    });

    this.add.text(width / 2, height - 78, '유닛 생산 1·2·3·4  ·  전직 5·6  ·  카메라 A/D 또는 ←/→  ·  확대 Q/E 또는 휠', {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: `${Math.min(16, width / 65)}px`, color: '#f1ead2',
      backgroundColor: '#0b1714cc', padding: { x: 16, y: 9 },
    }).setOrigin(.5);
  }
}
