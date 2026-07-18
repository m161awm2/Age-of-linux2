import Phaser from 'phaser';
import { UNIT_SCALE } from '../data/constants';
import { UNIT_SHEET_BY_KEY, type SpriteAsset } from '../assets/manifest';
import type { Team, UnitDefinition } from '../data/types';
import type { BaseEntity } from './BaseEntity';

export type AttackTarget = CombatUnit | BaseEntity;
type UnitState = 'idle' | 'move' | 'attack';
type ChannelKind = 'gatling' | 'flame';
export type DragonAttackKind = 'bite' | 'tail' | 'breath';

const FULL_CHARGE_TILES = 8;
const MAX_CHARGE_DAMAGE_BONUS = .5;
const DRAGON_BREATH_COOLDOWN_MS = 3000;

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
  retiariusReloadAt = 0;
  hasStartedCombat = false;
  dragonAttackKind: DragonAttackKind = 'bite';
  dragonBreathReadyAt = 0;
  dragonBreathTargets: AttackTarget[] = [];
  private channelKind: ChannelKind | null = null;
  private channelReadyAt = 0;
  private activeBurnStacks = 0;
  private networkTargetX: number | null = null;

  private textureKey: string;
  private spriteLayout: SpriteAsset;
  private readonly displayTeam: Team;
  private unitState: UnitState = 'idle';
  private readonly chargeFx: Phaser.GameObjects.Graphics;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly flameFx: Phaser.GameObjects.Sprite | null;
  private readonly hpBar: Phaser.GameObjects.Graphics;
  private readonly statusText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, definition: UnitDefinition, team: Team, x: number, y: number, displayTeam: Team = team) {
    super(scene, x, y);
    this.definition = definition;
    this.team = team;
    this.displayTeam = displayTeam;
    this.hp = definition.hp;
    this.dragonBreathReadyAt = definition.kind === 'adultDragon' ? scene.time.now + DRAGON_BREATH_COOLDOWN_MS : 0;
    this.shieldHp = definition.kind === 'shieldGuard' ? 8 : 0;
    this.textureKey = definition.texture;
    this.spriteLayout = this.getSpriteLayout(this.textureKey);
    this.chargeFx = scene.add.graphics();
    this.sprite = scene.add.sprite(0, 0, this.textureKey, 0);
    this.lockSpriteGeometry();
    this.sprite.setFlipX(team === 'enemy');
    const unitDepth = 20 + Math.round(y);
    this.flameFx = definition.kind === 'siphonarioi'
      ? scene.add.sprite(x, y - 69, 'siphonarioiFlame', 0).setDepth(unitDepth - 1).setVisible(false)
      : null;
    this.hpBar = scene.add.graphics();
    this.statusText = scene.add.text(0, -130 * this.visualScale, '', {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
      fontSize: '13px', color: '#fff9dd', stroke: '#16120d', strokeThickness: 4,
    }).setOrigin(.5);
    this.add([this.chargeFx, this.sprite, this.hpBar, this.statusText]);
    this.setSize(this.footprintWidth, 116 * this.visualScale);
    this.setDepth(unitDepth);
    scene.add.existing(this);

    this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, (_animation: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      this.lockSpriteGeometry();
      const frameNumber = Number(frame.textureFrame);
      if (this.channelKind) return;
      const hitFrame = this.definition.kind === 'adultDragon' && this.dragonAttackKind !== 'bite' ? 2 : 10;
      if (this.attackLocked && !this.hitApplied && frameNumber === hitFrame) {
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
        this.dragonBreathTargets = [];
        if (this.definition.kind === 'adultDragon' && this.textureKey !== this.definition.texture) {
          this.setVisualTexture(this.definition.texture);
        }
        this.dragonAttackKind = 'bite';
        if (this.alive) this.playState('idle');
      }
    });
    this.playState('idle');
    this.drawHealth(0);
  }

  get alive(): boolean { return this.hp > 0; }
  get visualScale(): number { return this.definition.visualScale ?? 1; }
  get footprintWidth(): number { return (this.definition.footprintTiles ?? 1) * 72; }
  get collisionRadius(): number { return this.footprintWidth / 2; }
  get burnStackCount(): number { return this.activeBurnStacks; }
  get isBerserking(): boolean { return this.definition.kind === 'viking' && this.berserkUntil > this.scene.time.now; }
  get isStunned(): boolean { return this.alive && this.stunnedUntil > this.scene.time.now; }
  get isChanneling(): boolean { return this.channelKind !== null; }
  get attackDamage(): number {
    if (this.definition.kind === 'retiarius' && this.isRetiariusMelee) return 12;
    return this.definition.damage + (this.definition.kind === 'shieldGuard' && this.shieldHp === 0 ? 2 : 0);
  }

  destroy(fromScene?: boolean): void {
    if (this.flameFx?.active) this.flameFx.destroy(fromScene);
    super.destroy(fromScene);
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
    this.playState('attack');
    // 낭인의 첫 발도술은 공격 모션은 재생하되 피해 선딜 없이 즉시 적중한다.
    if (instantIaiStrike) {
      this.hitApplied = true;
      this.scene.events.emit('unit-hit-frame', this, this.pendingTarget);
    }
  }

  startDragonAttack(kind: DragonAttackKind, targets: AttackTarget[], now: number): void {
    if (this.definition.kind !== 'adultDragon' || targets.length === 0 || this.attackLocked || now < this.nextAttackAt) return;
    this.dragonAttackKind = kind;
    this.dragonBreathTargets = kind === 'breath' ? [...targets] : [];
    if (kind === 'tail') this.setVisualTexture('adultDragonTail');
    else if (kind === 'breath') {
      this.setVisualTexture('adultDragonBreath');
      this.dragonBreathReadyAt = now + DRAGON_BREATH_COOLDOWN_MS;
    } else this.setVisualTexture(this.definition.texture);
    this.startAttack(targets[0]!, now);
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
      if (kind === 'flame') {
        // 점화 준비 중에는 불꽃이 포함된 공격 시트를 재생하지 않는다.
        // 실제 발사가 시작될 때 drawFlameFx에서 공격 모션으로 전환한다.
        this.unitState = 'move';
        this.sprite.play(`${this.textureKey}-move`, true);
        this.lockSpriteGeometry();
        this.flameFx?.stop().setVisible(false);
      } else this.playState('attack');
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
    this.flameFx?.stop().setVisible(false);
    if (this.alive) this.playState('idle');
  }

  applyStun(now: number, durationMs: number): void {
    if (!this.alive) return;
    this.stopChannel();
    this.stunnedUntil = Math.max(this.stunnedUntil, now + durationMs);
    this.attackLocked = false;
    this.pendingTarget = null;
    this.dragonBreathTargets = [];
    this.hitApplied = false;
    if (this.definition.kind === 'adultDragon' && this.textureKey !== this.definition.texture) {
      this.setVisualTexture(this.definition.texture);
      this.dragonAttackKind = 'bite';
    }
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
    if (!this.alive || this.definition.kind === 'adultDragon') return;
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
    const text = this.scene.add.text(this.x, this.y - 120 * this.visualScale, `-${label}`, {
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
    if (this.channelKind !== 'flame') {
      this.flameFx.stop().setVisible(false);
      return;
    }
    const direction = this.team === 'player' ? 1 : -1;
    const warmedUp = now >= this.channelReadyAt;
    if (!warmedUp) {
      this.flameFx.stop().setVisible(false);
      return;
    }
    this.playState('attack');
    if (!this.flameFx.anims.isPlaying) this.flameFx.play('siphonarioi-flame');
    this.flameFx
      .setVisible(true)
      .setPosition(this.x + direction * 42, this.y - 69)
      .setOrigin(direction > 0 ? 0 : 1, .5)
      .setFlipX(direction < 0)
      .setDisplaySize(281, 96)
      .setAlpha(1);
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
    const assetScale = this.spriteLayout.displayScale ?? 1;
    this.sprite
      .setOrigin(.5, 1)
      .setPosition(direction * this.spriteLayout.frameOffsetX * UNIT_SCALE * this.visualScale * assetScale, this.spriteLayout.frameOffsetY * UNIT_SCALE * this.visualScale * assetScale)
      .setDisplaySize(this.spriteLayout.frameWidth * UNIT_SCALE * this.visualScale * assetScale, this.spriteLayout.frameHeight * UNIT_SCALE * this.visualScale * assetScale);
  }

  private refreshBurnTint(): void {
    if (!this.sprite.active) return;
    if (this.activeBurnStacks > 0) this.sprite.setTint(0xff4a3d);
    else this.sprite.clearTint();
  }

  private drawHealth(now: number): void {
    const width = this.definition.kind === 'adultDragon' ? 150 : 70;
    const barY = -110 * this.visualScale;
    const ratio = Phaser.Math.Clamp(this.hp / this.definition.hp, 0, 1);
    const hpColor = this.displayTeam === 'player' ? 0x54dda0 : 0xf16b65;
    this.hpBar.clear();
    this.hpBar.fillStyle(0x17130f, .85).fillRoundedRect(-width / 2 - 2, barY - 2, width + 4, 10, 3);
    this.hpBar.fillStyle(hpColor).fillRoundedRect(-width / 2, barY, width * ratio, 6, 2);
    if (this.shieldHp > 0) this.hpBar.fillStyle(0x74c9ff).fillRoundedRect(-width / 2, barY + 9, width * (this.shieldHp / 8), 4, 2);
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
