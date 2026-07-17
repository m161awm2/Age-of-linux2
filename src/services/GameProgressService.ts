import { SECOND_PROMOTIONS, SPECIAL_ELITE } from '../data/constants';
import type { UnitKind } from '../data/types';
import type { SpecialPath } from './PlayerProgressService';

export class GameProgressService {
  infantry: UnitKind = 'soldier';
  archer: UnitKind = 'archer';
  cavalry: UnitKind = 'knight';
  special: UnitKind | null = null;
  specialPath: SpecialPath | null = null;
  readonly unlockedSpecialPaths: SpecialPath[];

  constructor(unlockedSpecialPaths: SpecialPath[] = []) {
    this.unlockedSpecialPaths = [...unlockedSpecialPaths];
  }

  get allFirstPromotionsComplete(): boolean {
    return this.infantry !== 'soldier' && this.archer !== 'archer' && this.cavalry !== 'knight';
  }

  setFirstPromotion(family: 'infantry' | 'archer' | 'cavalry', kind: UnitKind): void {
    this[family] = kind;
  }

  applySecondPromotion(family: 'infantry' | 'archer'): UnitKind | null {
    if (!this.allFirstPromotionsComplete) return null;
    const next = SECOND_PROMOTIONS[this[family]];
    if (!next) return null;
    this[family] = next;
    return next;
  }

  promoteSpecial(): UnitKind | null {
    if (!this.specialPath || this.special !== this.specialPath) return null;
    const elite = SPECIAL_ELITE[this.specialPath];
    this.special = elite;
    return elite;
  }

  selectSpecial(path: SpecialPath): UnitKind | null {
    if (this.specialPath || !this.unlockedSpecialPaths.includes(path)) return null;
    this.specialPath = path;
    this.special = path;
    return this.special;
  }
}
