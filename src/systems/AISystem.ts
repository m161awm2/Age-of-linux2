import { DIFFICULTIES } from '../data/constants';
import { UNITS } from '../data/units';
import type { Difficulty, UnitKind } from '../data/types';
import { EconomySystem } from './EconomySystem';

export class AISystem {
  readonly economy = new EconomySystem();
  readonly current: Record<'infantry' | 'archer' | 'cavalry', UnitKind> = {
    infantry: 'soldier', archer: 'archer', cavalry: 'knight',
  };
  private attemptTimer = 0;
  private infantryPromoted = false;
  private archerPromoted = false;
  private cavalryPromoted = false;

  constructor(private readonly difficulty: Difficulty) {}

  update(deltaSeconds: number, elapsedSeconds: number, spawn: (kind: UnitKind) => void): void {
    this.economy.update(deltaSeconds);
    this.updatePromotions(elapsedSeconds);
    this.attemptTimer += deltaSeconds;
    if (this.attemptTimer < .95) return;
    this.attemptTimer -= .95;
    this.trySpawn(spawn);
  }

  private updatePromotions(elapsed: number): void {
    const multiplier = DIFFICULTIES[this.difficulty].aiTimeMultiplier;
    if (!this.infantryPromoted && elapsed >= 50 * multiplier) {
      this.current.infantry = Phaser.Utils.Array.GetRandom<UnitKind>(['spearman', 'paladin', 'spartan']);
      this.infantryPromoted = true;
    }
    if (!this.archerPromoted && elapsed >= 100 * multiplier) {
      this.current.archer = Phaser.Utils.Array.GetRandom<UnitKind>(['musketeer', 'javelin', 'fireArcher']);
      this.archerPromoted = true;
    }
    if (!this.cavalryPromoted && elapsed >= 140 * multiplier) {
      this.current.cavalry = Phaser.Utils.Array.GetRandom<UnitKind>(['chariot', 'wingedHussar', 'dragoon']);
      this.cavalryPromoted = true;
    }
  }

  private trySpawn(spawn: (kind: UnitKind) => void): void {
    const multiplier = DIFFICULTIES[this.difficulty].aiCostMultiplier;
    const cost = (kind: UnitKind) => UNITS[kind].cost * multiplier;
    const soldier = this.current.infantry;
    const archer = this.current.archer;
    const cavalry = this.current.cavalry;
    if (this.economy.gold < cost(soldier)) return;

    let selected = soldier;
    if (this.economy.gold >= cost(cavalry)) {
      const roll = Math.random();
      selected = roll < .5 ? cavalry : roll < .8 && this.economy.gold >= cost(archer) ? archer : soldier;
    } else if (this.economy.gold >= cost(archer)) {
      selected = Math.random() < .6 ? archer : soldier;
    }
    this.economy.gold -= cost(selected);
    spawn(selected);
  }
}
