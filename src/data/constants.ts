import type { Difficulty, DifficultyConfig, UnitKind } from './types';

export const WORLD_WIDTH = 3600;
export const WORLD_HEIGHT = 2200;
export const GROUND_Y = 2000;
export const GROUND_TEXTURE_HEIGHT = 724;
export const GROUND_TEXTURE_SURFACE_Y = 488;
export const HILLS_TEXTURE_BOTTOM_Y = 723;
export const PLAYER_BASE_X = 250;
export const ENEMY_BASE_X = WORLD_WIDTH - 250;
export const UNIT_SCALE = 0.34;
export const BASE_MOVE_SPEED = 94;
export const ALLY_SPACING = 72;
export const ENEMY_STOP_DISTANCE = 78;
export const BASE_STOP_DISTANCE = 145;
export const TILE_SIZE = 76;

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  Easy: { label: '쉬움', enemyBaseHp: 100, aiCostMultiplier: 1.3, aiTimeMultiplier: 1.35, aiBountyRate: 0.55 },
  Medium: { label: '보통', enemyBaseHp: 200, aiCostMultiplier: 0.9, aiTimeMultiplier: 1.15, aiBountyRate: 0.65 },
  Hard: { label: '어려움', enemyBaseHp: 225, aiCostMultiplier: 0.8, aiTimeMultiplier: 1.075, aiBountyRate: 0.7 },
  Impossible: { label: '임파서블', enemyBaseHp: 250, aiCostMultiplier: 0.7, aiTimeMultiplier: 1, aiBountyRate: 0.75 },
};

export const PROMOTION_COSTS = {
  infantry: 20,
  archer: 25,
  cavalry: 30,
  secondInfantry: 35,
  specialElite: 60,
} as const;

export const PROMOTION_OPTIONS: Record<'infantry' | 'archer' | 'cavalry', UnitKind[]> = {
  infantry: ['spearman', 'paladin', 'spartan'],
  archer: ['musketeer', 'javelin', 'fireArcher'],
  cavalry: ['chariot', 'wingedHussar', 'dragoon'],
};

export const SECOND_PROMOTIONS: Partial<Record<UnitKind, UnitKind>> = {
  spearman: 'halberd',
  paladin: 'crusader',
  spartan: 'shieldGuard',
};

export const SPECIAL_UNLOCK_COST: Record<'ronin' | 'fenrir', number> = { ronin: 15, fenrir: 30 };
export const SPECIAL_ELITE: Record<'ronin' | 'fenrir', UnitKind> = { ronin: 'sanada', fenrir: 'viking' };
