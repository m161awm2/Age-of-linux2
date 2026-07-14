import Phaser from 'phaser';
import { ENEMY_BASE_X, PLAYER_BASE_X, TILE_SIZE } from '../data/constants';
import type { Team } from '../data/types';
import type { BaseEntity } from '../entities/BaseEntity';
import { CombatUnit, type AttackTarget } from '../entities/CombatUnit';

const CAVALRY = new Set(['knight', 'chariot', 'wingedHussar', 'dragoon']);
const RANGED = new Set(['archer', 'musketeer', 'javelin', 'fireArcher', 'dragoon']);
const FRONT_TARGETERS = new Set([
  'soldier', 'spearman', 'halberd', 'paladin', 'crusader', 'spartan', 'shieldGuard',
  'knight', 'chariot', 'wingedHussar', 'dragoon', 'fenrir', 'ronin', 'viking', 'sanada',
]);

export class CombatSystem {
  constructor(private readonly scene: Phaser.Scene) {
    scene.events.on('unit-hit-frame', this.onHitFrame, this);
  }

  destroy(): void { this.scene.events.off('unit-hit-frame', this.onHitFrame, this); }

  update(units: CombatUnit[], enemies: CombatUnit[], enemyBase: BaseEntity, now: number): void {
    for (const unit of units) {
      if (!unit.alive || unit.attackLocked) continue;
      const target = this.findTarget(unit, enemies);
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
    const distance = Math.abs(attacker.x - target.x);
    const dragoonMelee = attacker.definition.kind === 'dragoon' && distance <= 1.5 * TILE_SIZE;
    let damage = dragoonMelee ? Math.floor(attacker.definition.damage * 1.5) : attacker.definition.damage;

    if (attacker.definition.kind === 'wingedHussar' || attacker.definition.kind === 'sanada') {
      damage = Math.round(damage * attacker.chargeMultiplier(now));
    }
    if (attacker.definition.kind === 'fenrir' && RANGED.has(target.definition.kind)) damage = Math.floor(damage * 1.4);
    if (RANGED.has(attacker.definition.kind) && target.definition.kind === 'fenrir' && !dragoonMelee) damage = Math.floor(damage * .6);
    if (attacker.isBerserking) damage = Math.floor(damage * 2);
    if ((attacker.definition.kind === 'spearman' || attacker.definition.kind === 'halberd') && CAVALRY.has(target.definition.kind)) {
      damage = Math.floor(damage * 1.8);
    }
    if (attacker.definition.kind === 'halberd' || attacker.definition.kind === 'fireArcher') {
      damage += Math.floor(target.definition.hp * .12);
    }
    if (attacker.definition.kind === 'ronin' && attacker.firstStrike) {
      damage *= 2;
      attacker.firstStrike = false;
    }
    if (target.isBerserking) damage = Math.max(1, Math.floor(damage * .4));

    if (target.canParry(now)) {
      target.useParry(now);
      const reflected = damage * 2;
      attacker.takeDamage(reflected, now);
      attacker.showDamage(reflected, '#9eeeff');
      this.scene.events.emit('battle-message', '사나다가 공격을 패링해 두 배로 반격했습니다!');
    } else {
      const dealt = target.takeDamage(damage, now);
      target.showDamage(damage);
      if (attacker.definition.kind === 'viking' && dealt > 0) attacker.heal(1);
      if (attacker.definition.kind === 'crusader' && dealt > 0) {
        attacker.healCounter += 1;
        if (attacker.healCounter >= 2) {
          attacker.heal(1);
          attacker.healCounter = 0;
        }
      }
    }

    attacker.resetCharge(now);
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

  private applyBaseDamage(attacker: CombatUnit, base: BaseEntity): void {
    let damage = attacker.definition.damage;
    if (attacker.isBerserking) damage = Math.floor(damage * 2);
    base.takeDamage(damage);
    attacker.resetCharge(this.scene.time.now);
    const text = this.scene.add.text(base.x, base.y - 300, `-${damage}`, {
      fontFamily: 'Pretendard, sans-serif', fontSize: '24px', fontStyle: 'bold', color: '#ffd27c',
      stroke: '#2a170d', strokeThickness: 6,
    }).setOrigin(.5).setDepth(100);
    this.scene.tweens.add({ targets: text, y: text.y - 45, alpha: 0, duration: 650, onComplete: () => text.destroy() });
  }

  private inRange(attacker: CombatUnit, target: CombatUnit): boolean {
    return Math.abs(attacker.x - target.x) <= attacker.definition.rangeTiles * TILE_SIZE + 18;
  }

  private canAttackBase(unit: CombatUnit, base: BaseEntity): boolean {
    const baseX = unit.team === 'player' ? ENEMY_BASE_X : PLAYER_BASE_X;
    return base.hp > 0 && Math.abs(unit.x - baseX) <= unit.definition.rangeTiles * TILE_SIZE + 135;
  }

  private prepareOpeningAttack(unit: CombatUnit, now: number, interval: number): void {
    if (unit.hasStartedCombat) return;
    unit.hasStartedCombat = true;
    const opensImmediately = CAVALRY.has(unit.definition.kind) || unit.definition.kind === 'sanada';
    if (!opensImmediately) unit.nextAttackAt = now + interval * 200;
  }

  private flashAttack(attacker: CombatUnit, target: AttackTarget): void {
    if (!attacker.definition.ranged || attacker.isDragoonMelee) return;
    const color = attacker.definition.kind === 'fireArcher' ? 0xff7b32 : attacker.definition.kind === 'musketeer' || attacker.definition.kind === 'dragoon' ? 0xffe2a1 : 0xd9c28f;
    const graphics = this.scene.add.graphics().setDepth(40);
    graphics.lineStyle(4, color, .95).lineBetween(attacker.x, attacker.y - 70, target.x, target.y - 65);
    const spark = this.scene.add.circle(target.x, target.y - 65, 8, color, .9).setDepth(41);
    this.scene.tweens.add({ targets: [graphics, spark], alpha: 0, duration: 180, onComplete: () => { graphics.destroy(); spark.destroy(); } });
  }

  private frontSort(team: Team): (a: CombatUnit, b: CombatUnit) => number {
    return team === 'player' ? (a, b) => b.x - a.x : (a, b) => a.x - b.x;
  }
}
