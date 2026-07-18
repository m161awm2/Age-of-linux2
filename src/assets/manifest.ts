export interface SpriteAsset {
  key: string;
  file: string;
  width: number;
  height: number;
  frameWidth: number;
  frameHeight: number;
  frameOffsetX: number;
  frameOffsetY: number;
  displayScale?: number;
  animationFrames?: {
    idle: { start: number; end: number };
    move: { start: number; end: number };
    attack: { start: number; end: number };
  };
}

export const UNIT_FRAME_WIDTH = 496;
export const UNIT_FRAME_HEIGHT = 400;
export const UNIT_FRAME_ANCHOR_X = 204;

const sheet = (
  key: string,
  file: string,
  frameOffsetX = UNIT_FRAME_WIDTH / 2 - UNIT_FRAME_ANCHOR_X,
  frameOffsetY = 0,
): SpriteAsset => ({
  key,
  file: `assets/units/${file}`,
  width: UNIT_FRAME_WIDTH * 4,
  height: UNIT_FRAME_HEIGHT * 3,
  frameWidth: UNIT_FRAME_WIDTH,
  frameHeight: UNIT_FRAME_HEIGHT,
  frameOffsetX,
  frameOffsetY,
});

const dragonActionSheet = (key: string, file: string, frameOffsetY: number): SpriteAsset => ({
  key,
  file: `assets/units/${file}`,
  width: 543 * 4,
  height: 724,
  frameWidth: 543,
  frameHeight: 724,
  frameOffsetX: 0,
  frameOffsetY,
  displayScale: .75,
  animationFrames: {
    idle: { start: 0, end: 0 },
    move: { start: 0, end: 0 },
    attack: { start: 0, end: 3 },
  },
});

export const UNIT_SHEETS: SpriteAsset[] = [
  sheet('soldier', 'soldier.png'), sheet('archer', 'archer.png'), sheet('knight', 'knight.png'),
  sheet('spearman', 'spearman.png'), sheet('paladin', 'paladin.png'), sheet('spartan', 'spartan.png'),
  sheet('javelin', 'javelin.png'), sheet('musketeer', 'musketeer.png'), sheet('fireArcher', 'fire-archer.png'),
  sheet('gatlingGunner', 'gatling-gunner.png'), sheet('retiariusRanged', 'retiarius-ranged.png'),
  sheet('retiariusMelee', 'retiarius-melee.png'), sheet('siphonarioi', 'siphonarioi.png'),
  sheet('chariot', 'chariot.png'), sheet('wingedHussar', 'winged-hussar.png'), sheet('dragoon', 'dragoon-ranged.png'),
  sheet('dragoonMelee', 'dragoon-melee.png'), sheet('fenrir', 'fenrir.png'), sheet('ronin', 'ronin.png'),
  sheet('crusader', 'crusader.png'), sheet('shieldGuard', 'shield-guard.png'), sheet('shieldGuardBroken', 'shield-guard-broken.png'),
  sheet('halberd', 'halberd.png'), sheet('viking', 'viking.png'), sheet('vikingBerserk', 'viking-berserk.png'),
  sheet('sanada', 'sanada.png'),
  sheet('hatchling', '1차.png'), sheet('adultDragon', '모션+물기.png'),
  dragonActionSheet('adultDragonTail', '꼬리치기.png', 229),
  dragonActionSheet('adultDragonBreath', '브레스.png', 199),
];

export const UNIT_SHEET_BY_KEY: ReadonlyMap<string, SpriteAsset> = new Map(
  UNIT_SHEETS.map((asset) => [asset.key, asset]),
);

export const IMAGE_ASSETS = [
  { key: 'logo', file: 'assets/branding/age-of-linux-logo.png' },
  { key: 'playerBase', file: 'assets/bases/player-wooden-outpost.png' },
  { key: 'enemyBase', file: 'assets/bases/enemy-stone-castle.png' },
  { key: 'sky', file: 'assets/backgrounds/sky.png' },
  { key: 'hills', file: 'assets/backgrounds/distant-hills.png' },
  { key: 'ground', file: 'assets/backgrounds/battle-ground.png' },
];
