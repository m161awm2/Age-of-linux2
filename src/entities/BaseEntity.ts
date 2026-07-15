import Phaser from 'phaser';
import type { Team } from '../data/types';

export class BaseEntity extends Phaser.GameObjects.Container {
  readonly team: Team;
  readonly maxHp: number;
  hp: number;
  private readonly displayTeam: Team;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly hpText: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    team: Team,
    x: number,
    y: number,
    hp: number,
    appearanceTeam: Team = team,
    displayTeam: Team = team,
  ) {
    super(scene, x, y);
    this.team = team;
    this.maxHp = hp;
    this.hp = hp;
    this.displayTeam = displayTeam;

    const texture = appearanceTeam === 'player' ? 'playerBase' : 'enemyBase';
    // 원본 PNG의 투명 여백을 제외한 실제 건물 하단을 지면에 맞춘다.
    const contentBottomOrigin = appearanceTeam === 'player' ? 793 / 1024 : 815 / 1024;
    const image = scene.add.image(0, 0, texture).setOrigin(.5, contentBottomOrigin).setDisplaySize(390, 260);
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
    const color = this.displayTeam === 'player' ? 0x55d790 : 0xf26c62;
    this.bar.clear();
    this.bar.fillStyle(0x17130f, .88).fillRoundedRect(-width / 2 - 4, -263, width + 8, 22, 7);
    this.bar.fillStyle(color).fillRoundedRect(-width / 2, -259, width * ratio, 14, 5);
    this.hpText.setText(`${this.displayTeam === 'player' ? '아군 역참' : '상대 역참'}  ${Math.ceil(this.hp)} / ${this.maxHp}`);
  }
}
