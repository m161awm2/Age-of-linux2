import Phaser from 'phaser';
import { ENEMY_BASE_X, PLAYER_BASE_X, TILE_SIZE } from '../data/constants';
import type { Team } from '../data/types';
import type { BaseEntity } from '../entities/BaseEntity';
import { CombatUnit, type AttackTarget } from '../entities/CombatUnit';

const CAVALRY = new Set(['knight', 'chariot', 'wingedHussar', 'dragoon']);
const RANGED = new Set(['archer', 'musketeer', 'gatlingGunner', 'javelin', 'retiarius', 'fireArcher', 'siphonarioi', 'dragoon']);
const SIPHONARIOI_ATTACK_RANGE_TILES = 4;
const FRONT_TARGETERS = new Set([
  'soldier', 'spearman', 'halberd', 'paladin', 'crusader', 'spartan', 'shieldGuard',
  'knight', 'chariot', 'wingedHussar', 'dragoon', 'fenrir', 'ronin', 'viking', 'sanada', 'hatchling', 'adultDragon',
]);
const DRAGON_BREATH_RECOGNITION_TILES = 3;
const DRAGON_BREATH_RANGE_TILES = 5;
const DRAGON_BREATH_DAMAGE = 23;

export class CombatSystem {
  constructor(private readonly scene: Phaser.Scene) {
    scene.events.on('unit-hit-frame', this.onHitFrame, this);
  }

  destroy(): void { this.scene.events.off('unit-hit-frame', this.onHitFrame, this); }

  update(units: CombatUnit[], enemies: CombatUnit[], enemyBase: BaseEntity, now: number): void {
    for (const unit of units) {
      if (!unit.alive || unit.isStunned) continue;
      if (unit.definition.kind === 'gatlingGunner') {
        this.updateGatling(unit, enemies, enemyBase, now);
        continue;
      }
      if (unit.definition.kind === 'siphonarioi') {
        this.updateSiphonarioi(unit, enemies, enemyBase, now);
        continue;
      }
      if (unit.definition.kind === 'adultDragon') {
        this.updateAdultDragon(unit, enemies, enemyBase, now);
        continue;
      }
      if (unit.attackLocked) continue;
      const target = this.findTarget(unit, enemies);
      if (unit.definition.kind === 'retiarius') {
        this.updateRetiarius(unit, target ?? (this.canAttackBase(unit, enemyBase) ? enemyBase : null), now);
        continue;
      }
      if (target) {
        const distance = Math.abs(target.x - unit.x);
        const dragoonMelee = unit.definition.kind === 'dragoon' && distance <= 1.5 * TILE_SIZE;
        unit.setDragoonMode(dragoonMelee);
        this.prepareOpeningAttack(unit, now, dragoonMelee ? 1 : unit.definition.attackInterval);
        unit.startAttack(target, now, dragoonMelee ? 1 : undefined);
      } else if (this.canAttackBase(unit, enemyBase)) {
        unit.setDragoonMode(false);
        this.prepareOpeningAttack(unit, now, unit.definition.attackInterval);
        unit.startAttack(enemyBase, now);
      } else {
        unit.setDragoonMode(false);
      }
    }
  }

  private updateAdultDragon(unit: CombatUnit, enemies: CombatUnit[], enemyBase: BaseEntity, now: number): void {
    if (unit.attackLocked) return;
    const direction = unit.team === 'player' ? 1 : -1;
    if (now >= unit.dragonBreathReadyAt) {
      const recognized = enemies.some((enemy) => enemy.alive
        && direction * (enemy.x - unit.x) >= -enemy.collisionRadius
        && Math.abs(enemy.x - unit.x) <= DRAGON_BREATH_RECOGNITION_TILES * TILE_SIZE + unit.collisionRadius);
      const baseRecognized = this.canAttackBase(unit, enemyBase, DRAGON_BREATH_RECOGNITION_TILES);
      if (recognized || baseRecognized) {
        const targets: AttackTarget[] = enemies.filter((enemy) => enemy.alive
          && direction * (enemy.x - unit.x) >= -enemy.collisionRadius
          && Math.abs(enemy.x - unit.x) <= DRAGON_BREATH_RANGE_TILES * TILE_SIZE + unit.collisionRadius);
        if (this.canAttackBase(unit, enemyBase, DRAGON_BREATH_RANGE_TILES)) targets.push(enemyBase);
        if (targets.length > 0) {
          unit.startDragonAttack('breath', targets, now);
          return;
        }
      }
    }
    const target: AttackTarget | null = this.findTarget(unit, enemies)
      ?? (this.canAttackBase(unit, enemyBase) ? enemyBase : null);
    if (!target) return;
    this.prepareOpeningAttack(unit, now, unit.definition.attackInterval);
    unit.startDragonAttack(target instanceof CombatUnit && Math.random() < .3 ? 'tail' : 'bite', [target], now);
  }

  private updateGatling(unit: CombatUnit, enemies: CombatUnit[], enemyBase: BaseEntity, now: number): void {
    const target: AttackTarget | null = this.findTarget(unit, enemies)
      ?? (this.canAttackBase(unit, enemyBase) ? enemyBase : null);
    if (!target) {
      unit.stopChannel();
      return;
    }
    unit.startChannel('gatling', now, 900);
    if (!unit.consumeChannelTick(now, unit.definition.attackInterval)) return;
    this.flashAttack(unit, target);
    if (target instanceof CombatUnit) this.applyUnitDamage(unit, target);
    else this.applyBaseDamage(unit, target);
  }

  private updateRetiarius(unit: CombatUnit, target: AttackTarget | null, now: number): void {
    if (!target) return;
    const distance = Math.abs(target.x - unit.x);
    const meleeRange = target instanceof CombatUnit ? 1.5 * TILE_SIZE : 2.1 * TILE_SIZE;
    if (distance <= meleeRange) {
      unit.setRetiariusMode(true);
      this.prepareOpeningAttack(unit, now, unit.definition.attackInterval);
      unit.startAttack(target, now);
      return;
    }
    unit.setRetiariusMode(false);
    if (unit.retiariusThrown && now < unit.retiariusReloadAt) return;
    unit.retiariusThrown = false;
    this.prepareOpeningAttack(unit, now, unit.definition.attackInterval);
    unit.startAttack(target, now);
    if (unit.attackLocked) {
      unit.retiariusThrown = true;
      unit.retiariusReloadAt = now + 2000;
    }
  }

  private updateSiphonarioi(unit: CombatUnit, enemies: CombatUnit[], enemyBase: BaseEntity, now: number): void {
    const direction = unit.team === 'player' ? 1 : -1;
    const recognizedTargets = enemies.filter((enemy) => enemy.alive
      && direction * (enemy.x - unit.x) >= -18
      && Math.abs(enemy.x - unit.x) <= unit.definition.rangeTiles * TILE_SIZE + 18);
    const attackTargets = enemies.filter((enemy) => enemy.alive
      && direction * (enemy.x - unit.x) >= -18
      && Math.abs(enemy.x - unit.x) <= SIPHONARIOI_ATTACK_RANGE_TILES * TILE_SIZE + 18);
    const baseRecognized = this.canAttackBase(unit, enemyBase);
    const baseInAttackRange = this.canAttackBase(unit, enemyBase, SIPHONARIOI_ATTACK_RANGE_TILES);
    const canContinueAttacking = unit.isChanneling && (attackTargets.length > 0 || baseInAttackRange);
    if (recognizedTargets.length === 0 && !baseRecognized && !canContinueAttacking) {
      unit.stopChannel();
      return;
    }
    unit.startChannel('flame', now, 1000);
    if (!unit.consumeChannelTick(now, unit.definition.attackInterval)) return;
    attackTargets.forEach((target) => {
      if (target.alive) this.applyUnitDamage(unit, target);
    });
    if (baseInAttackRange) this.applyBaseDamage(unit, enemyBase);
  }

  hasTargetInRange(unit: CombatUnit, enemies: CombatUnit[]): boolean {
    return this.findTarget(unit, enemies) !== null;
  }

  findTarget(unit: CombatUnit, enemies: CombatUnit[]): CombatUnit | null {
    const alive = enemies.filter((enemy) => enemy.alive).sort(this.frontSort(enemies[0]?.team ?? (unit.team === 'player' ? 'enemy' : 'player')));
    if (FRONT_TARGETERS.has(unit.definition.kind)) {
      const front = alive[0];
      return front && this.inRange(unit, front) ? front : null;
    }
    return alive.find((enemy) => this.inRange(unit, enemy)) ?? null;
  }

  private onHitFrame(attacker: CombatUnit, target: AttackTarget | null): void {
    if (!attacker.alive || !target) return;
    if (attacker.definition.kind === 'adultDragon' && attacker.dragonAttackKind === 'breath') {
      this.applyDragonBreath(attacker);
      return;
    }
    if (target instanceof CombatUnit) {
      if (!target.alive) return;
      this.flashAttack(attacker, target);
      this.applyUnitDamage(attacker, target);
    } else {
      if (target.hp <= 0) return;
      this.flashAttack(attacker, target);
      this.applyBaseDamage(attacker, target);
    }
  }

  private applyUnitDamage(attacker: CombatUnit, target: CombatUnit): void {
    const now = this.scene.time.now;
    const isIaiStrike = attacker.definition.kind === 'ronin' && attacker.firstStrike;
    const canBeParried = attacker.definition.kind !== 'siphonarioi'
      && !(attacker.definition.kind === 'adultDragon' && attacker.dragonAttackKind === 'breath');
    const distance = Math.abs(attacker.x - target.x);
    const dragoonMelee = attacker.definition.kind === 'dragoon' && distance <= 1.5 * TILE_SIZE;
    let damage = dragoonMelee ? Math.floor(attacker.attackDamage * 1.5) : attacker.attackDamage;
    let chargeBonus = 0;

    if (attacker.definition.kind === 'wingedHussar' || attacker.definition.kind === 'sanada') {
      const chargeMultiplier = attacker.chargeMultiplier(now);
      chargeBonus = Math.round((chargeMultiplier - 1) * 100);
      damage = Math.round(damage * chargeMultiplier);
    }
    if (attacker.definition.kind === 'fenrir' && RANGED.has(target.definition.kind)) damage = Math.floor(damage * 1.4);
    if (RANGED.has(attacker.definition.kind) && target.definition.kind === 'fenrir' && !dragoonMelee) damage = Math.floor(damage * .6);
    if ((attacker.definition.kind === 'spearman' || attacker.definition.kind === 'halberd') && CAVALRY.has(target.definition.kind)) {
      damage = Math.floor(damage * 1.8);
    }
    if (attacker.definition.kind === 'halberd') damage += Math.floor(target.definition.hp * .15);
    if (attacker.definition.kind === 'ronin' && attacker.firstStrike) {
      damage *= 2;
      attacker.firstStrike = false;
    }
    if (target.isBerserking) damage = Math.max(1, Math.floor(damage * .4));

    if (canBeParried && target.canParry(now)) {
      target.useParry(now);
      const reflected = damage * 2;
      attacker.takeDamage(reflected, now);
      attacker.showDamage(reflected, '#9eeeff');
      this.scene.events.emit('battle-message', '사나다가 공격을 패링해 두 배로 반격했습니다!');
    } else {
      if (isIaiStrike) target.flashIaiHit();
      const dealt = target.takeDamage(damage, now);
      target.showDamage(damage, chargeBonus > 0 ? '#ffd45c' : '#fff1b4');
      const appliesBurn = attacker.definition.kind === 'fireArcher'
        || (attacker.definition.kind === 'siphonarioi' && Math.random() < .5)
        || attacker.definition.kind === 'hatchling';
      if (appliesBurn && dealt > 0 && target.alive) target.applyBurnStack();
      if (isIaiStrike && target.alive) target.applyStun(now, 400);
      if (attacker.definition.kind === 'adultDragon' && attacker.dragonAttackKind === 'tail' && target.alive) {
        target.flashIaiHit();
        target.applyStun(now, 800);
      }
      if (attacker.definition.kind === 'viking' && dealt > 0) attacker.heal(1);
      if (attacker.definition.kind === 'crusader' && dealt > 0) {
        attacker.healCounter += 1;
        if (attacker.healCounter >= 2) {
          attacker.heal(1);
          attacker.healCounter = 0;
        }
      }
    }

    if (chargeBonus > 0) this.flashChargeImpact(attacker, target, chargeBonus);
    attacker.consumeCharge();
    if (
      (target.definition.kind === 'spearman' || target.definition.kind === 'halberd')
      && CAVALRY.has(attacker.definition.kind)
      && !dragoonMelee
      && attacker.definition.kind === 'dragoon'
    ) return;
    if (
      (target.definition.kind === 'spearman' || target.definition.kind === 'halberd')
      && CAVALRY.has(attacker.definition.kind)
      && !attacker.tookSpearmanCounter
    ) {
      attacker.tookSpearmanCounter = true;
      attacker.takeDamage(target.definition.damage, now);
      attacker.showDamage(target.definition.damage, '#b9e6ff');
    }
  }

  private applyDragonBreath(attacker: CombatUnit): void {
    const now = this.scene.time.now;
    this.flashDragonBreath(attacker);
    attacker.dragonBreathTargets.forEach((target) => {
      if (target instanceof CombatUnit) {
        if (!target.alive) return;
        const dealt = target.takeDamage(DRAGON_BREATH_DAMAGE, now);
        target.showDamage(DRAGON_BREATH_DAMAGE, '#ff8a42');
        if (dealt > 0 && target.alive) target.applyBurnStack();
      } else if (target.hp > 0) {
        target.takeDamage(DRAGON_BREATH_DAMAGE);
      }
    });
  }

  private applyBaseDamage(attacker: CombatUnit, base: BaseEntity): void {
    const now = this.scene.time.now;
    let damage = attacker.attackDamage;
    let chargeBonus = 0;
    if (attacker.definition.kind === 'wingedHussar' || attacker.definition.kind === 'sanada') {
      const chargeMultiplier = attacker.chargeMultiplier(now);
      chargeBonus = Math.round((chargeMultiplier - 1) * 100);
      damage = Math.round(damage * chargeMultiplier);
    }
    base.takeDamage(damage);
    if (attacker.definition.kind === 'ronin' && attacker.firstStrike) attacker.firstStrike = false;
    if (chargeBonus > 0) this.flashChargeImpact(attacker, base, chargeBonus);
    attacker.consumeCharge();
    const text = this.scene.add.text(base.x, base.y - 300, `-${damage}`, {
      fontFamily: 'Pretendard, sans-serif', fontSize: '24px', fontStyle: 'bold', color: '#ffd27c',
      stroke: '#2a170d', strokeThickness: 6,
    }).setOrigin(.5).setDepth(100);
    this.scene.tweens.add({ targets: text, y: text.y - 45, alpha: 0, duration: 650, onComplete: () => text.destroy() });
  }

  private inRange(attacker: CombatUnit, target: CombatUnit): boolean {
    return Math.abs(attacker.x - target.x) <= this.getAttackRangeTiles(attacker) * TILE_SIZE
      + attacker.collisionRadius + target.collisionRadius - 54;
  }

  private canAttackBase(unit: CombatUnit, base: BaseEntity, rangeTiles = this.getAttackRangeTiles(unit)): boolean {
    const baseX = unit.team === 'player' ? ENEMY_BASE_X : PLAYER_BASE_X;
    return base.hp > 0 && Math.abs(unit.x - baseX) <= rangeTiles * TILE_SIZE + 135;
  }

  private getAttackRangeTiles(unit: CombatUnit): number {
    return unit.definition.kind === 'shieldGuard' && unit.shieldHp === 0
      ? 1.5
      : unit.definition.rangeTiles;
  }

  private prepareOpeningAttack(unit: CombatUnit, now: number, interval: number): void {
    if (unit.hasStartedCombat) return;
    unit.hasStartedCombat = true;
    // 돌진 병종(기병·로닌·사나다)은 초기 쿨다운 0초, 나머지는 공속의 20%만큼 최초 선딜을 가진다.
    const opensImmediately = unit.definition.family === 'cavalry'
      || unit.definition.kind === 'ronin'
      || unit.definition.kind === 'sanada';
    unit.nextAttackAt = opensImmediately ? now : now + interval * 200;
  }

  private flashAttack(attacker: CombatUnit, target: AttackTarget): void {
    if (!attacker.definition.ranged || attacker.isDragoonMelee || attacker.isRetiariusMelee || attacker.definition.kind === 'siphonarioi') return;
    const color = attacker.definition.kind === 'fireArcher'
      ? 0xff7b32
      : attacker.definition.kind === 'musketeer' || attacker.definition.kind === 'gatlingGunner' || attacker.definition.kind === 'dragoon'
        ? 0xffe2a1
        : 0xd9c28f;
    const graphics = this.scene.add.graphics().setDepth(40);
    graphics.lineStyle(4, color, .95).lineBetween(attacker.x, attacker.y - 70, target.x, target.y - 65);
    const spark = this.scene.add.circle(target.x, target.y - 65, 8, color, .9).setDepth(41);
    this.scene.tweens.add({ targets: [graphics, spark], alpha: 0, duration: 180, onComplete: () => { graphics.destroy(); spark.destroy(); } });
  }

  private flashChargeImpact(attacker: CombatUnit, target: AttackTarget, bonus: number): void {
    const color = attacker.definition.kind === 'sanada' ? 0xff5a45 : 0xffd45c;
    const x = target.x;
    const y = target.y - 62;
    const ring = this.scene.add.circle(x, y, 18, color, .22).setStrokeStyle(7, color, .95).setDepth(95);
    const slash = this.scene.add.rectangle(x, y, 92, 10, color, .95)
      .setRotation(attacker.team === 'player' ? -.28 : .28)
      .setDepth(96);
    const label = this.scene.add.text(x, y - 52, `돌진 +${bonus}%`, {
      fontFamily: 'Pretendard, sans-serif', fontSize: '22px', fontStyle: 'bold', color: '#fff3b0',
      stroke: '#541b0e', strokeThickness: 6,
    }).setOrigin(.5).setDepth(100);
    this.scene.tweens.add({ targets: ring, scale: 3.2, alpha: 0, duration: 280, onComplete: () => ring.destroy() });
    this.scene.tweens.add({ targets: slash, scaleX: 1.8, alpha: 0, duration: 220, onComplete: () => slash.destroy() });
    this.scene.tweens.add({ targets: label, y: label.y - 35, alpha: 0, duration: 700, onComplete: () => label.destroy() });
    this.scene.cameras.main.shake(90, .0025);
  }

  private flashDragonBreath(attacker: CombatUnit): void {
    const direction = attacker.team === 'player' ? 1 : -1;
    const length = DRAGON_BREATH_RANGE_TILES * TILE_SIZE;
    const effect = this.scene.add.sprite(attacker.x + direction * (attacker.collisionRadius + length / 2), attacker.y - 125, 'dragonBreathFx', 0)
      .setOrigin(.5)
      .setFlipX(direction > 0)
      .setDisplaySize(length, 190)
      .setDepth(45)
      .play('dragon-breath-fx');
    effect.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => effect.destroy());
    this.scene.cameras.main.shake(130, .002);
  }

  private frontSort(team: Team): (a: CombatUnit, b: CombatUnit) => number {
    return team === 'player' ? (a, b) => b.x - a.x : (a, b) => a.x - b.x;
  }
}
