import { SECOND_PROMOTIONS, SPECIAL_ELITE } from '../data/constants';
import type { UnitKind } from '../data/types';

export class GameProgressService {
  infantry: UnitKind = 'soldier';
  archer: UnitKind = 'archer';
  cavalry: UnitKind = 'knight';
  special: UnitKind | null = null;
  specialPath: 'ronin' | 'fenrir' | null = null;

  get allFirstPromotionsComplete(): boolean {
    return this.infantry !== 'soldier' && this.archer !== 'archer' && this.cavalry !== 'knight';
  }

  setFirstPromotion(family: 'infantry' | 'archer' | 'cavalry', kind: UnitKind): void {
    this[family] = kind;
  }

  applySecondInfantryPromotion(): UnitKind | null {
    if (!this.allFirstPromotionsComplete) return null;
    const next = SECOND_PROMOTIONS[this.infantry];
    if (!next) return null;
    this.infantry = next;
    return next;
  }

  unlockSpecial(path: 'ronin' | 'fenrir'): void {
    if (this.specialPath) return;
    this.specialPath = path;
    this.special = path;
  }

  promoteSpecial(): UnitKind | null {
    if (!this.specialPath || this.special !== this.specialPath) return null;
    const elite = SPECIAL_ELITE[this.specialPath];
    this.special = elite;
    return elite;
  }
}
