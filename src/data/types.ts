export type Team = 'player' | 'enemy';
export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type UnitFamily = 'infantry' | 'archer' | 'cavalry' | 'special';

export type UnitKind =
  | 'soldier' | 'spearman' | 'halberd' | 'paladin' | 'crusader' | 'spartan' | 'shieldGuard'
  | 'archer' | 'musketeer' | 'javelin' | 'fireArcher'
  | 'knight' | 'chariot' | 'wingedHussar' | 'dragoon'
  | 'fenrir' | 'ronin' | 'viking' | 'sanada';

export interface UnitDefinition {
  kind: UnitKind;
  name: string;
  symbol: string;
  family: UnitFamily;
  tier: 0 | 1 | 2;
  texture: string;
  hp: number;
  damage: number;
  originalDamage: number;
  cost: number;
  rangeTiles: number;
  attackInterval: number;
  originalAttackInterval: number;
  ranged: boolean;
  speedMultiplier: number;
  description: string;
  eliteCooldown?: number;
}

export interface DifficultyConfig {
  label: string;
  enemyBaseHp: number;
  aiCostMultiplier: number;
  aiTimeMultiplier: number;
  aiBountyRate: number;
}

export interface GameLaunchData {
  difficulty: Difficulty;
}

export interface GameResultData extends GameLaunchData {
  victory: boolean;
  elapsedSeconds: number;
  rankedRunId?: string;
  unitLoadout: UnitKind[];
}
