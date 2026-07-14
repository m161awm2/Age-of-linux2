import Phaser from 'phaser';
import type { Team } from '../data/types';

export class BaseEntity extends Phaser.GameObjects.Container {
  readonly team: Team;
  readonly maxHp: number;
  hp: number;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly hpText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, team: Team, x: number, y: number, hp: number) {
    super(scene, x, y);
    this.team = team;
    this.maxHp = hp;
    this.hp = hp;

    const texture = team === 'player' ? 'playerBase' : 'enemyBase';
    const image = scene.add.image(0, 0, texture).setOrigin(.5, 1).setDisplaySize(390, 260);
    if (team === 'enemy') image.setFlipX(true);
    this.bar = scene.add.graphics();
    this.hpText = scene.add.text(0, -278, '', {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
      fontSize: '18px',
      color: '#fff8dd',
      stroke: '#19130e',
      strokeThickness: 5,
    }).setOrigin(.5);
    this.add([image, this.bar, this.hpText]);
    scene.add.existing(this);
    this.setDepth(12);
    this.drawHealth();
  }

  takeDamage(amount: number): void {
    if (this.hp <= 0) return;
    this.hp = Math.max(0, this.hp - amount);
    this.drawHealth();
    this.scene.tweens.add({ targets: this, alpha: .55, yoyo: true, duration: 80 });
  }

  private drawHealth(): void {
    const width = 230;
    const ratio = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
    const color = this.team === 'player' ? 0x55d790 : 0xf26c62;
    this.bar.clear();
    this.bar.fillStyle(0x17130f, .88).fillRoundedRect(-width / 2 - 4, -263, width + 8, 22, 7);
    this.bar.fillStyle(color).fillRoundedRect(-width / 2, -259, width * ratio, 14, 5);
    this.hpText.setText(`${this.team === 'player' ? '아군 역참' : '적군 성'}  ${Math.ceil(this.hp)} / ${this.maxHp}`);
  }
}
