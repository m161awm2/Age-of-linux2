import Phaser from 'phaser';
import { UNIT_SCALE } from '../data/constants';
import { UNIT_SHEET_BY_KEY, type SpriteAsset } from '../assets/manifest';
import type { Team, UnitDefinition } from '../data/types';
import type { BaseEntity } from './BaseEntity';

export type AttackTarget = CombatUnit | BaseEntity;
type UnitState = 'idle' | 'move' | 'attack';
type ChannelKind = 'gatling' | 'flame';

const FULL_CHARGE_TILES = 8;
const MAX_CHARGE_DAMAGE_BONUS = .5;

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
  stunnedUntil = 0;
  chargeTiles = 0;
  chargeDamageTiles = 0;
  chargeGraceUntil = 0;
  isDragoonMelee = false;
  isRetiariusMelee = false;
  retiariusThrown = false;
  hasStartedCombat = false;
  private channelKind: ChannelKind | null = null;
  private channelReadyAt = 0;
  private readonly comboHitFrames = new Set<number>();
  private activeBurnStacks = 0;
  private networkTargetX: number | null = null;

  private textureKey: string;
  private spriteLayout: SpriteAsset;
  private readonly displayTeam: Team;
  private unitState: UnitState = 'idle';
  private readonly chargeFx: Phaser.GameObjects.Graphics;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly flameFx: Phaser.GameObjects.Graphics | null;
  private readonly hpBar: Phaser.GameObjects.Graphics;
  private readonly statusText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, definition: UnitDefinition, team: Team, x: number, y: number, displayTeam: Team = team) {
    super(scene, x, y);
    this.definition = definition;
    this.team = team;
    this.displayTeam = displayTeam;
    this.hp = definition.hp;
    this.shieldHp = definition.kind === 'shieldGuard' ? 8 : 0;
    this.textureKey = definition.texture;
    this.spriteLayout = this.getSpriteLayout(this.textureKey);
    this.chargeFx = scene.add.graphics();
    this.sprite = scene.add.sprite(0, 0, this.textureKey, 0);
    this.lockSpriteGeometry();
    this.sprite.setFlipX(team === 'enemy');
    this.flameFx = definition.kind === 'siphonarioi'
      ? scene.add.graphics().setVisible(false)
      : null;
    this.hpBar = scene.add.graphics();
    this.statusText = scene.add.text(0, -130, '', {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
      fontSize: '13px', color: '#fff9dd', stroke: '#16120d', strokeThickness: 4,
    }).setOrigin(.5);
    this.add([this.chargeFx, this.sprite, ...(this.flameFx ? [this.flameFx] : []), this.hpBar, this.statusText]);
    this.setSize(72, 116);
    this.setDepth(20 + Math.round(y));
    scene.add.existing(this);

    this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, (_animation: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      this.lockSpriteGeometry();
      const frameNumber = Number(frame.textureFrame);
      if (this.channelKind) return;
      if (this.definition.kind === 'retiarius' && this.isRetiariusMelee && this.attackLocked && [9, 10, 11].includes(frameNumber)) {
        if (this.comboHitFrames.has(frameNumber)) return;
        this.comboHitFrames.add(frameNumber);
        this.scene.events.emit('unit-hit-frame', this, this.pendingTarget);
      } else if (this.attackLocked && !this.hitApplied && frameNumber === 10) {
        this.hitApplied = true;
        this.scene.events.emit('unit-hit-frame', this, this.pendingTarget);
      }
    });
    this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (animation: Phaser.Animations.Animation) => {
      if (animation.key.endsWith('-attack')) {
        if (this.channelKind && this.alive) {
          this.sprite.play(`${this.textureKey}-attack`, true);
          return;
        }
        this.attackLocked = false;
        this.pendingTarget = null;
        if (this.alive) this.playState('idle');
      }
    });
    this.playState('idle');
    this.drawHealth(0);
  }

  get alive(): boolean { return this.hp > 0; }
  get burnStackCount(): number { return this.activeBurnStacks; }
  get isBerserking(): boolean { return this.definition.kind === 'viking' && this.berserkUntil > this.scene.time.now; }
  get isStunned(): boolean { return this.alive && this.stunnedUntil > this.scene.time.now; }
  get isChanneling(): boolean { return this.channelKind !== null; }
  get attackDamage(): number {
    return this.definition.damage + (this.definition.kind === 'shieldGuard' && this.shieldHp === 0 ? 2 : 0);
  }

  playState(state: UnitState): void {
    if (!this.alive || (this.attackLocked && state !== 'attack')) return;
    if (this.unitState === state && this.sprite.anims.isPlaying) return;
    this.unitState = state;
    this.sprite.play(`${this.textureKey}-${state}`, true);
    this.lockSpriteGeometry();
  }

  startAttack(target: AttackTarget, now: number, intervalOverride?: number): void {
    if (!this.alive || this.isStunned || this.attackLocked || now < this.nextAttackAt) return;
    const interval = intervalOverride ?? this.definition.attackInterval;
    const instantIaiStrike = this.definition.kind === 'ronin' && this.firstStrike;
    this.nextAttackAt = now + interval * 1000 * (this.isBerserking ? .6 : 1);
    this.attackLocked = true;
    this.pendingTarget = target;
    this.hitApplied = false;
    this.comboHitFrames.clear();
    this.playState('attack');
    // 낭인의 첫 발도술은 공격 모션은 재생하되 피해 선딜 없이 즉시 적중한다.
    if (instantIaiStrike) {
      this.hitApplied = true;
      this.scene.events.emit('unit-hit-frame', this, this.pendingTarget);
    }
  }

  startChannel(kind: ChannelKind, now: number, warmupMs: number): void {
    if (!this.alive || this.isStunned) return;
    if (this.channelKind !== kind) {
      this.channelKind = kind;
      this.channelReadyAt = now + warmupMs;
      this.nextAttackAt = this.channelReadyAt;
      this.attackLocked = true;
      this.pendingTarget = null;
      this.hitApplied = false;
      this.playState('attack');
      if (kind === 'flame') {
        this.flameFx?.setVisible(true);
      }
    }
  }

  consumeChannelTick(now: number, intervalSeconds: number): boolean {
    if (!this.channelKind || now < this.nextAttackAt) return false;
    this.nextAttackAt = now + intervalSeconds * 1000;
    return true;
  }

  stopChannel(): void {
    if (!this.channelKind) return;
    this.channelKind = null;
    this.channelReadyAt = 0;
    this.attackLocked = false;
    this.pendingTarget = null;
    this.hitApplied = false;
    this.flameFx?.clear().setVisible(false);
    if (this.alive) this.playState('idle');
  }

  applyStun(now: number, durationMs: number): void {
    if (!this.alive) return;
    this.stopChannel();
    this.stunnedUntil = Math.max(this.stunnedUntil, now + durationMs);
    this.attackLocked = false;
    this.pendingTarget = null;
    this.hitApplied = false;
    this.sprite.stop();
    this.unitState = 'idle';
    this.sprite.play(`${this.textureKey}-idle`, true);
  }

  flashIaiHit(): void {
    if (!this.alive) return;
    this.sprite.setTint(0x55ff88);
    this.scene.time.delayedCall(120, () => {
      if (this.sprite.active) this.refreshBurnTint();
    });
  }

  applyBurnStack(): void {
    if (!this.alive) return;
    this.activeBurnStacks += 1;
    this.refreshBurnTint();
    this.updateStatus(this.scene.time.now);
    const tickDamage = this.definition.hp * .05;
    for (let tick = 1; tick <= 3; tick += 1) {
      this.scene.time.delayedCall(tick * 500, () => {
        if (this.alive) {
          this.takeDamage(tickDamage, this.scene.time.now);
          this.showDamage(tickDamage, '#ff654d');
        }
        if (tick === 3) {
          this.activeBurnStacks = Math.max(0, this.activeBurnStacks - 1);
          if (this.active) {
            this.refreshBurnTint();
            this.updateStatus(this.scene.time.now);
          }
        }
      });
    }
  }

  setDragoonMode(melee: boolean): void {
    if (this.definition.kind !== 'dragoon' || this.isDragoonMelee === melee) return;
    this.isDragoonMelee = melee;
    this.setVisualTexture(melee ? 'dragoonMelee' : 'dragoon');
  }

  setRetiariusMode(melee: boolean): void {
    if (this.definition.kind !== 'retiarius' || this.isRetiariusMelee === melee) return;
    this.isRetiariusMelee = melee;
    this.setVisualTexture(melee ? 'retiariusMelee' : 'retiariusRanged');
  }

  takeDamage(amount: number, now: number): number {
    if (!this.alive) return 0;
    const rounded = amount < 1 ? Math.max(.01, amount) : Math.floor(amount);
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
      this.scene.events.emit('battle-message', `${this.displayTeam === 'player' ? '아군' : '적군'} 바이킹이 광폭화했습니다!`);
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

  consumeCharge(): void {
    this.chargeTiles = 0;
    this.chargeDamageTiles = 0;
    this.chargeGraceUntil = 0;
  }

  chargeMultiplier(now: number): number {
    const tiles = now < this.chargeGraceUntil ? Math.max(this.chargeTiles, this.chargeDamageTiles) : this.chargeTiles;
    return 1 + Math.min(tiles / FULL_CHARGE_TILES, 1) * MAX_CHARGE_DAMAGE_BONUS;
  }

  speedMultiplier(now: number): number {
    if (this.isBerserking) return 2.5;
    if (this.definition.kind === 'wingedHussar' || this.definition.kind === 'sanada') {
      const acceleration = Math.min(this.chargeTiles / FULL_CHARGE_TILES, 1) * .6;
      return this.definition.speedMultiplier + acceleration;
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
    this.drawChargeFx(chargeBonus);
    this.drawFlameFx(now);
    const states = [
      this.isStunned ? '기절' : '',
      this.isBerserking ? '광폭' : '',
      this.channelKind === 'gatling' ? (now < this.channelReadyAt ? '예열' : '연사') : '',
      this.channelKind === 'flame' ? '화염 분사' : '',
      this.definition.kind === 'retiarius' && this.retiariusThrown && !this.isRetiariusMelee ? '고속 접근' : '',
      this.canParry(now) ? '패링' : '',
      this.definition.kind === 'shieldGuard' && this.shieldHp === 0 ? '롱소드 +2' : '',
      chargeBonus > 0 ? `돌진 +${chargeBonus}%` : '',
    ].filter(Boolean);
    this.statusText.setText(states.join(' · '));
  }

  applyNetworkState(x: number, hp: number, burnStacks = 0): void {
    if (!Number.isFinite(x)) return;
    this.networkTargetX = x;
    this.hp = Phaser.Math.Clamp(hp, 0, this.definition.hp);
    this.activeBurnStacks = Math.max(0, Math.floor(burnStacks));
    this.refreshBurnTint();
    this.drawHealth(this.scene.time.now);
  }

  updateNetworkPosition(dt: number): void {
    if (this.networkTargetX === null || !this.alive) return;
    const distance = this.networkTargetX - this.x;
    if (Math.abs(distance) > 300) this.x = this.networkTargetX;
    else this.x += distance * (1 - Math.exp(-18 * dt));
    const moving = Math.abs(this.networkTargetX - this.x) > .5;
    if (!moving) this.x = this.networkTargetX;
    this.playState(moving ? 'move' : 'idle');
  }

  showDamage(amount: number, color = '#fff1b4'): void {
    const label = Number.isInteger(amount) ? amount.toString() : amount.toFixed(1);
    const text = this.scene.add.text(this.x, this.y - 120, `-${label}`, {
      fontFamily: 'Pretendard, sans-serif', fontSize: '20px', fontStyle: 'bold', color,
      stroke: '#1b120c', strokeThickness: 5,
    }).setOrigin(.5).setDepth(100);
    this.scene.tweens.add({ targets: text, y: text.y - 45, alpha: 0, duration: 650, onComplete: () => text.destroy() });
  }

  private drawChargeFx(chargeBonus: number): void {
    this.chargeFx.clear();
    if (chargeBonus < 8 || this.unitState !== 'move') return;
    const direction = this.team === 'player' ? -1 : 1;
    const strength = Phaser.Math.Clamp(chargeBonus / 50, .25, 1);
    this.chargeFx.lineStyle(5, 0xffd45c, .3 + strength * .45);
    this.chargeFx.lineBetween(direction * 24, -76, direction * (55 + strength * 45), -76);
    this.chargeFx.lineStyle(3, 0xfff1a6, .25 + strength * .5);
    this.chargeFx.lineBetween(direction * 18, -55, direction * (44 + strength * 55), -55);
    this.chargeFx.lineBetween(direction * 16, -96, direction * (38 + strength * 38), -96);
  }

  private drawFlameFx(now: number): void {
    if (!this.flameFx) return;
    this.flameFx.clear();
    if (this.channelKind !== 'flame') {
      this.flameFx.setVisible(false);
      return;
    }
    this.flameFx.setVisible(true);
    const direction = this.team === 'player' ? 1 : -1;
    const warmedUp = now >= this.channelReadyAt;
    const pulse = Math.sin(now * .025);
    const nozzleX = direction * 42;
    const centerY = -69;
    const length = warmedUp ? 178 + pulse * 12 : 34 + pulse * 5;
    const tipX = nozzleX + direction * length;
    const outerWidth = warmedUp ? 48 + Math.sin(now * .019) * 7 : 15;

    this.flameFx.fillStyle(0xe74313, .72);
    this.flameFx.beginPath();
    this.flameFx.moveTo(nozzleX, centerY - 8);
    this.flameFx.lineTo(tipX, centerY + Math.sin(now * .031) * 10);
    this.flameFx.lineTo(nozzleX, centerY + 8);
    this.flameFx.closePath().fillPath();

    this.flameFx.fillStyle(0xff861c, .9);
    this.flameFx.beginPath();
    this.flameFx.moveTo(nozzleX, centerY - outerWidth * .45);
    this.flameFx.lineTo(nozzleX + direction * length * .76, centerY - outerWidth * .32 + pulse * 5);
    this.flameFx.lineTo(tipX, centerY + Math.sin(now * .027) * 8);
    this.flameFx.lineTo(nozzleX + direction * length * .7, centerY + outerWidth * .4 - pulse * 4);
    this.flameFx.lineTo(nozzleX, centerY + outerWidth * .45);
    this.flameFx.closePath().fillPath();

    this.flameFx.fillStyle(0xffd94a, .96);
    this.flameFx.beginPath();
    this.flameFx.moveTo(nozzleX, centerY - 7);
    this.flameFx.lineTo(nozzleX + direction * length * .62, centerY - 12 + pulse * 3);
    this.flameFx.lineTo(nozzleX + direction * length * .82, centerY + Math.sin(now * .037) * 5);
    this.flameFx.lineTo(nozzleX + direction * length * .58, centerY + 12 - pulse * 3);
    this.flameFx.lineTo(nozzleX, centerY + 7);
    this.flameFx.closePath().fillPath();

    if (!warmedUp) return;
    for (let ember = 0; ember < 4; ember += 1) {
      const phase = now * .006 + ember * 1.7;
      const distance = 95 + ((now * .11 + ember * 43) % 115);
      this.flameFx.fillStyle(ember % 2 === 0 ? 0xffb52e : 0xff6120, .75);
      this.flameFx.fillCircle(nozzleX + direction * distance, centerY + Math.sin(phase) * 25, 3 + ember % 2);
    }
  }

  private setVisualTexture(textureKey: string): void {
    if (this.textureKey === textureKey) return;
    this.textureKey = textureKey;
    this.spriteLayout = this.getSpriteLayout(textureKey);
    this.sprite.setTexture(textureKey, 0);
    this.lockSpriteGeometry();
    this.sprite.setFlipX(this.team === 'enemy');
    this.refreshBurnTint();
    this.unitState = 'idle';
    if (!this.attackLocked) this.playState('idle');
  }

  private getSpriteLayout(textureKey: string): SpriteAsset {
    const layout = UNIT_SHEET_BY_KEY.get(textureKey);
    if (!layout) throw new Error(`스프라이트 레이아웃을 찾을 수 없습니다: ${textureKey}`);
    return layout;
  }

  private lockSpriteGeometry(): void {
    const direction = this.team === 'enemy' ? -1 : 1;
    this.sprite
      .setOrigin(.5, 1)
      .setPosition(direction * this.spriteLayout.frameOffsetX * UNIT_SCALE, this.spriteLayout.frameOffsetY * UNIT_SCALE)
      .setDisplaySize(this.spriteLayout.frameWidth * UNIT_SCALE, this.spriteLayout.frameHeight * UNIT_SCALE);
  }

  private refreshBurnTint(): void {
    if (!this.sprite.active) return;
    if (this.activeBurnStacks > 0) this.sprite.setTint(0xff4a3d);
    else this.sprite.clearTint();
  }

  private drawHealth(now: number): void {
    const width = 70;
    const ratio = Phaser.Math.Clamp(this.hp / this.definition.hp, 0, 1);
    const hpColor = this.displayTeam === 'player' ? 0x54dda0 : 0xf16b65;
    this.hpBar.clear();
    this.hpBar.fillStyle(0x17130f, .85).fillRoundedRect(-width / 2 - 2, -112, width + 4, 10, 3);
    this.hpBar.fillStyle(hpColor).fillRoundedRect(-width / 2, -110, width * ratio, 6, 2);
    if (this.shieldHp > 0) this.hpBar.fillStyle(0x74c9ff).fillRoundedRect(-width / 2, -101, width * (this.shieldHp / 8), 4, 2);
    this.updateStatus(now);
  }

  private die(): void {
    this.stopChannel();
    this.attackLocked = false;
    this.sprite.stop();
    this.scene.tweens.add({
      targets: this, alpha: 0, y: this.y + 18, angle: this.team === 'player' ? -8 : 8,
      duration: 400, onComplete: () => this.setVisible(false),
    });
  }
}
