import Phaser from 'phaser';
import { UNIT_SCALE } from '../data/constants';
import type { Team, UnitDefinition } from '../data/types';
import type { BaseEntity } from './BaseEntity';

export type AttackTarget = CombatUnit | BaseEntity;
type UnitState = 'idle' | 'move' | 'attack';

let nextId = 1;

export class CombatUnit extends Phaser.GameObjects.Container {
  readonly id = nextId++;
  readonly team: Team;
  readonly definition: UnitDefinition;
  hp: number;
  shieldHp: number;
  nextAttackAt = 0;
  attackLocked = false;
  pendingTarget: AttackTarget | null = null;
  hitApplied = false;
  firstStrike = true;
  healCounter = 0;
  bountyPaid = false;
  tookSpearmanCounter = false;
  berserkTriggered = false;
  berserkUntil = 0;
  parryReadyAt = 0;
  chargeTiles = 0;
  chargeDamageTiles = 0;
  chargeGraceUntil = 0;
  isDragoonMelee = false;
  hasStartedCombat = false;

  private textureKey: string;
  private unitState: UnitState = 'idle';
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly hpBar: Phaser.GameObjects.Graphics;
  private readonly statusText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, definition: UnitDefinition, team: Team, x: number, y: number) {
    super(scene, x, y);
    this.definition = definition;
    this.team = team;
    this.hp = definition.hp;
    this.shieldHp = definition.kind === 'shieldGuard' ? 8 : 0;
    this.textureKey = definition.texture;
    // 정규화된 모든 프레임의 발 기준선(340px)을 컨테이너 위치에 고정한다.
    this.sprite = scene.add.sprite(0, 0, this.textureKey, 0).setOrigin(.5, 340 / 362).setScale(UNIT_SCALE);
    this.sprite.setFlipX(team === 'enemy');
    this.hpBar = scene.add.graphics();
    this.statusText = scene.add.text(0, -130, '', {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
      fontSize: '13px', color: '#fff9dd', stroke: '#16120d', strokeThickness: 4,
    }).setOrigin(.5);
    this.add([this.sprite, this.hpBar, this.statusText]);
    this.setSize(72, 116);
    this.setDepth(20 + Math.round(y));
    scene.add.existing(this);

    this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, (_animation: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (this.attackLocked && !this.hitApplied && Number(frame.textureFrame) === 10) {
        this.hitApplied = true;
        this.scene.events.emit('unit-hit-frame', this, this.pendingTarget);
      }
    });
    this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (animation: Phaser.Animations.Animation) => {
      if (animation.key.endsWith('-attack')) {
        this.attackLocked = false;
        this.pendingTarget = null;
        if (this.alive) this.playState('idle');
      }
    });
    this.playState('idle');
    this.drawHealth(0);
  }

  get alive(): boolean { return this.hp > 0; }
  get isBerserking(): boolean { return this.definition.kind === 'viking' && this.berserkUntil > this.scene.time.now; }

  playState(state: UnitState): void {
    if (!this.alive || (this.attackLocked && state !== 'attack')) return;
    if (this.unitState === state && this.sprite.anims.isPlaying) return;
    this.unitState = state;
    this.sprite.play(`${this.textureKey}-${state}`, true);
  }

  startAttack(target: AttackTarget, now: number, intervalOverride?: number): void {
    if (!this.alive || this.attackLocked || now < this.nextAttackAt) return;
    const interval = intervalOverride ?? this.definition.attackInterval;
    this.nextAttackAt = now + interval * 1000 * (this.isBerserking ? .6 : 1);
    this.attackLocked = true;
    this.pendingTarget = target;
    this.hitApplied = false;
    this.playState('attack');
  }

  setDragoonMode(melee: boolean): void {
    if (this.definition.kind !== 'dragoon' || this.isDragoonMelee === melee) return;
    this.isDragoonMelee = melee;
    this.setVisualTexture(melee ? 'dragoonMelee' : 'dragoon');
  }

  takeDamage(amount: number, now: number): number {
    if (!this.alive) return 0;
    const rounded = Math.max(1, Math.floor(amount));
    if (this.shieldHp > 0) {
      this.shieldHp = Math.max(0, this.shieldHp - rounded);
      if (this.shieldHp === 0) this.setVisualTexture('shieldGuardBroken');
      this.drawHealth(now);
      return 0;
    }
    this.hp = Math.max(0, this.hp - rounded);
    if (this.definition.kind === 'viking' && !this.berserkTriggered && this.hp > 0 && this.hp <= this.definition.hp / 2) {
      this.berserkTriggered = true;
      this.berserkUntil = now + 7000;
      this.setVisualTexture('vikingBerserk');
      this.scene.events.emit('battle-message', `${this.team === 'player' ? '아군' : '적군'} 바이킹이 광폭화했습니다!`);
    }
    this.drawHealth(now);
    if (!this.alive) this.die();
    return rounded;
  }

  heal(amount: number): void {
    if (!this.alive) return;
    this.hp = Math.min(this.definition.hp, this.hp + amount);
    this.drawHealth(this.scene.time.now);
  }

  addCharge(pixels: number): void {
    if (this.definition.kind !== 'wingedHussar' && this.definition.kind !== 'sanada') return;
    this.chargeTiles += pixels / 76;
  }

  resetCharge(now: number): void {
    if (this.chargeTiles <= 0) return;
    this.chargeDamageTiles = Math.max(this.chargeDamageTiles, this.chargeTiles);
    this.chargeGraceUntil = now + 1000;
    this.chargeTiles = 0;
  }

  chargeMultiplier(now: number): number {
    const tiles = now < this.chargeGraceUntil ? Math.max(this.chargeTiles, this.chargeDamageTiles) : this.chargeTiles;
    const speedGain = Math.min(tiles * .08, 1.4);
    return 1 + .2 * (speedGain / 1.4);
  }

  speedMultiplier(now: number): number {
    if (this.isBerserking) return 2.5;
    if (this.definition.kind === 'wingedHussar' || this.definition.kind === 'sanada') {
      return Math.min(this.definition.speedMultiplier + this.chargeTiles * .04, 2.4);
    }
    if (now >= this.chargeGraceUntil) this.chargeDamageTiles = 0;
    return this.definition.speedMultiplier;
  }

  canParry(now: number): boolean { return this.definition.kind === 'sanada' && now >= this.parryReadyAt; }
  useParry(now: number): void { this.parryReadyAt = now + 2000; }

  updateStatus(now: number): void {
    if (this.definition.kind === 'viking' && this.berserkTriggered && now >= this.berserkUntil && this.textureKey === 'vikingBerserk') {
      this.setVisualTexture('viking');
    }
    const chargeBonus = this.definition.kind === 'wingedHussar' || this.definition.kind === 'sanada'
      ? Math.round((this.chargeMultiplier(now) - 1) * 100)
      : 0;
    const states = [
      this.isBerserking ? '광폭' : '',
      this.canParry(now) ? '패링' : '',
      chargeBonus > 0 ? `돌진 +${chargeBonus}%` : '',
    ].filter(Boolean);
    this.statusText.setText(states.join(' · '));
  }

  showDamage(amount: number, color = '#fff1b4'): void {
    const text = this.scene.add.text(this.x, this.y - 120, `-${Math.floor(amount)}`, {
      fontFamily: 'Pretendard, sans-serif', fontSize: '20px', fontStyle: 'bold', color,
      stroke: '#1b120c', strokeThickness: 5,
    }).setOrigin(.5).setDepth(100);
    this.scene.tweens.add({ targets: text, y: text.y - 45, alpha: 0, duration: 650, onComplete: () => text.destroy() });
  }

  private setVisualTexture(textureKey: string): void {
    if (this.textureKey === textureKey) return;
    this.textureKey = textureKey;
    this.sprite.setTexture(textureKey, 0);
    this.sprite.setFlipX(this.team === 'enemy');
    this.unitState = 'idle';
    if (!this.attackLocked) this.playState('idle');
  }

  private drawHealth(now: number): void {
    const width = 70;
    const ratio = Phaser.Math.Clamp(this.hp / this.definition.hp, 0, 1);
    const hpColor = this.team === 'player' ? 0x54dda0 : 0xf16b65;
    this.hpBar.clear();
    this.hpBar.fillStyle(0x17130f, .85).fillRoundedRect(-width / 2 - 2, -112, width + 4, 10, 3);
    this.hpBar.fillStyle(hpColor).fillRoundedRect(-width / 2, -110, width * ratio, 6, 2);
    if (this.shieldHp > 0) this.hpBar.fillStyle(0x74c9ff).fillRoundedRect(-width / 2, -101, width * (this.shieldHp / 8), 4, 2);
    this.updateStatus(now);
  }

  private die(): void {
    this.attackLocked = false;
    this.sprite.stop();
    this.scene.tweens.add({
      targets: this, alpha: 0, y: this.y + 18, angle: this.team === 'player' ? -8 : 8,
      duration: 400, onComplete: () => this.setVisible(false),
    });
  }
}
