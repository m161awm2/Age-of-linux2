import Phaser from 'phaser';
import { DIFFICULTIES } from '../data/constants';
import type { GameResultData } from '../data/types';

export class ResultScene extends Phaser.Scene {
  private result!: GameResultData;
  constructor() { super('ResultScene'); }
  init(data: GameResultData): void { this.result = data; }

  create(): void {
    const { width, height } = this.scale;
    this.add.image(width / 2, height / 2, 'sky').setDisplaySize(width, height);
    this.add.image(width / 2, height, 'hills').setOrigin(.5, 1).setDisplaySize(width, height);
    this.add.rectangle(width / 2, height / 2, width, height, this.result.victory ? 0x123c27 : 0x3b1515, .72);
    this.add.text(width / 2, height * .3, this.result.victory ? '승리' : '패배', {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: '78px', fontStyle: 'bold',
      color: this.result.victory ? '#dff28b' : '#ff9c83', stroke: '#181b13', strokeThickness: 9,
    }).setOrigin(.5);
    const minutes = Math.floor(this.result.elapsedSeconds / 60);
    const seconds = Math.floor(this.result.elapsedSeconds % 60).toString().padStart(2, '0');
    this.add.text(width / 2, height * .46, `${DIFFICULTIES[this.result.difficulty].label} · 전투 시간 ${minutes}:${seconds}`, {
      fontFamily: 'Pretendard, sans-serif', fontSize: '22px', color: '#f8efd5',
    }).setOrigin(.5);
    this.createButton(width / 2 - 105, height * .62, '다시 전투', () => this.scene.start('GameScene', { difficulty: this.result.difficulty }));
    this.createButton(width / 2 + 105, height * .62, '시작 화면', () => this.scene.start('StartScene'));
    this.input.keyboard?.on('keydown-R', () => this.scene.start('GameScene', { difficulty: this.result.difficulty }));
  }

  private createButton(x: number, y: number, label: string, action: () => void): void {
    const button = this.add.rectangle(x, y, 185, 62, 0x294838).setStrokeStyle(2, 0xbcd277).setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, { fontFamily: 'Pretendard, sans-serif', fontSize: '20px', fontStyle: 'bold', color: '#fff5d2' }).setOrigin(.5);
    button.on('pointerover', () => button.setScale(1.04)).on('pointerout', () => button.setScale(1)).on('pointerdown', action);
  }
}
