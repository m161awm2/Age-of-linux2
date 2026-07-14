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
    const buttonWidth = Math.min(185, width * .21);
    const buttonStyles: Record<Difficulty, { top: number; bottom: number; border: number; glow: number; symbol: string; hint: string }> = {
      Easy: { top: 0x39895b, bottom: 0x17452e, border: 0x8be2aa, glow: 0x69d894, symbol: '◆', hint: '여유로운 전투' },
      Medium: { top: 0xb18a27, bottom: 0x5d4512, border: 0xffdb67, glow: 0xf0c94f, symbol: '◆◆', hint: '균형 잡힌 전투' },
      Hard: { top: 0xa8453e, bottom: 0x5e211f, border: 0xff8e7e, glow: 0xf06a5d, symbol: '◆◆◆', hint: '거센 적의 공세' },
    };
    difficulties.forEach((difficulty, index) => {
      const x = width / 2 + (index - 1) * Math.min(210, width * .24);
      const config = DIFFICULTIES[difficulty];
      const style = buttonStyles[difficulty];
      const shadow = this.add.graphics().fillStyle(0x020705, .58).fillRoundedRect(-buttonWidth / 2 + 4, -35, buttonWidth, 82, 13);
      const panel = this.add.graphics();
      panel.fillGradientStyle(style.top, style.top, style.bottom, style.bottom, 1)
        .fillRoundedRect(-buttonWidth / 2, -41, buttonWidth, 82, 13)
        .lineStyle(2, style.border, 1).strokeRoundedRect(-buttonWidth / 2, -41, buttonWidth, 82, 13)
        .lineStyle(1, 0xffffff, .2).strokeRoundedRect(-buttonWidth / 2 + 5, -36, buttonWidth - 10, 72, 9)
        .fillStyle(style.glow, .9).fillRoundedRect(-buttonWidth / 2 + 10, -35, buttonWidth - 20, 3, 2);
      const symbol = this.add.text(0, -27, style.symbol, {
        fontFamily: 'Georgia, serif', fontSize: '10px', color: `#${style.border.toString(16).padStart(6, '0')}`,
      }).setOrigin(.5);
      const title = this.add.text(0, -8, config.label, {
        fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: '23px', fontStyle: 'bold', color: '#fff8df',
        stroke: '#1a160d', strokeThickness: 3,
      }).setOrigin(.5);
      const detail = this.add.text(0, 14, `적 기지 ${config.enemyBaseHp} HP`, {
        fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: '12px', color: '#fff3cf',
      }).setOrigin(.5);
      const hint = this.add.text(0, 31, style.hint, {
        fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: '10px', color: '#fffbe6',
      }).setAlpha(.72).setOrigin(.5);
      const button = this.add.container(x, buttonY, [shadow, panel, symbol, title, detail, hint])
        .setSize(buttonWidth, 82)
        .setInteractive(new Phaser.Geom.Rectangle(-buttonWidth / 2, -41, buttonWidth, 82), Phaser.Geom.Rectangle.Contains);
      button.input!.cursor = 'pointer';
      button.on('pointerover', () => {
        button.setScale(1.055);
        panel.setAlpha(1);
        this.tweens.killTweensOf(button);
        this.tweens.add({ targets: button, y: buttonY - 4, duration: 110, ease: 'Sine.Out' });
      }).on('pointerout', () => {
        button.setScale(1);
        this.tweens.killTweensOf(button);
        this.tweens.add({ targets: button, y: buttonY, duration: 110, ease: 'Sine.Out' });
      }).on('pointerdown', () => button.setScale(1.015))
        .on('pointerup', () => this.scene.start('GameScene', { difficulty }));
    });

    this.add.text(width / 2, height - 78, '유닛 생산 1·2·3·4  ·  전직 5·6  ·  카메라 A/D 또는 ←/→  ·  확대 Q/E 또는 휠', {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: `${Math.min(16, width / 65)}px`, color: '#f1ead2',
      backgroundColor: '#0b1714cc', padding: { x: 16, y: 9 },
    }).setOrigin(.5);
  }
}
