import type { UnitDefinition, UnitKind } from './types';

const unit = (definition: UnitDefinition): UnitDefinition => definition;

export const UNITS: Record<UnitKind, UnitDefinition> = {
  soldier: unit({ kind: 'soldier', name: '기본 보병', symbol: '#', family: 'infantry', tier: 0, texture: 'soldier', hp: 15, damage: 5, originalDamage: 5, cost: 4, rangeTiles: 1, attackInterval: 1, originalAttackInterval: 1, ranged: false, speedMultiplier: 1, description: '저렴한 전선 유지 유닛' }),
  spearman: unit({ kind: 'spearman', name: '창병', symbol: 'S', family: 'infantry', tier: 1, texture: 'spearman', hp: 16, damage: 6, originalDamage: 7, cost: 4, rangeTiles: 2, attackInterval: 1.2, originalAttackInterval: 1.1, ranged: false, speedMultiplier: 1, description: '기병에게 1.8배 피해와 첫 돌격 반격' }),
  halberd: unit({ kind: 'halberd', name: '할버드', symbol: 'H', family: 'infantry', tier: 2, texture: 'halberd', hp: 18, damage: 8, originalDamage: 8, cost: 6, rangeTiles: 2, attackInterval: 1, originalAttackInterval: 1, ranged: false, speedMultiplier: 1, description: '기병 1.8배 + 최대 HP 20% 추가 피해' }),
  paladin: unit({ kind: 'paladin', name: '팔라딘', symbol: 'P', family: 'infantry', tier: 1, texture: 'paladin', hp: 25, damage: 7, originalDamage: 6, cost: 6, rangeTiles: 1, attackInterval: .8, originalAttackInterval: .7, ranged: false, speedMultiplier: 1, description: '튼튼하고 빠른 근접 전사' }),
  crusader: unit({ kind: 'crusader', name: '크루세이더', symbol: 'U', family: 'infantry', tier: 2, texture: 'crusader', hp: 26, damage: 8, originalDamage: 7, cost: 6, rangeTiles: 1, attackInterval: .8, originalAttackInterval: .7, ranged: false, speedMultiplier: 1, description: '두 번 공격할 때마다 HP 1 회복' }),
  spartan: unit({ kind: 'spartan', name: '스파르타', symbol: 'T', family: 'infantry', tier: 1, texture: 'spartan', hp: 33, damage: 5, originalDamage: 5, cost: 6, rangeTiles: 1, attackInterval: 1, originalAttackInterval: 1, ranged: false, speedMultiplier: 1, description: '보병 최강의 생존력' }),
  shieldGuard: unit({ kind: 'shieldGuard', name: '방패병', symbol: 'G', family: 'infantry', tier: 2, texture: 'shieldGuard', hp: 33, damage: 5, originalDamage: 5, cost: 6, rangeTiles: 1, attackInterval: 1, originalAttackInterval: 1, ranged: false, speedMultiplier: 1, description: '8 방패로 공격을 흡수하고, 파괴 후 롱소드 공격력 +2' }),

  archer: unit({ kind: 'archer', name: '기본 궁수', symbol: '&', family: 'archer', tier: 0, texture: 'archer', hp: 9, damage: 3, originalDamage: 3, cost: 5, rangeTiles: 4, attackInterval: 1.4, originalAttackInterval: 1.4, ranged: true, speedMultiplier: 1, description: '표준 원거리 지원 유닛' }),
  musketeer: unit({ kind: 'musketeer', name: '머스킷병', symbol: 'M', family: 'archer', tier: 1, texture: 'musketeer', hp: 10, damage: 9, originalDamage: 9, cost: 8, rangeTiles: 6, attackInterval: 2, originalAttackInterval: 2, ranged: true, speedMultiplier: 1, description: '초장거리 저격수' }),
  javelin: unit({ kind: 'javelin', name: '투창병', symbol: 'J', family: 'archer', tier: 1, texture: 'javelin', hp: 17, damage: 7, originalDamage: 7, cost: 6, rangeTiles: 3, attackInterval: 1.5, originalAttackInterval: 1.5, ranged: true, speedMultiplier: 1, description: '짧은 사거리, 높은 체력과 공격력' }),
  fireArcher: unit({ kind: 'fireArcher', name: '불화살 사수', symbol: 'F', family: 'archer', tier: 1, texture: 'fireArcher', hp: 11, damage: 6, originalDamage: 6, cost: 7, rangeTiles: 5, attackInterval: 2, originalAttackInterval: 2, ranged: true, speedMultiplier: 1, description: '최대 HP 12% 추가 피해' }),

  knight: unit({ kind: 'knight', name: '기사', symbol: '@', family: 'cavalry', tier: 0, texture: 'knight', hp: 27, damage: 8, originalDamage: 8, cost: 13, rangeTiles: 2, attackInterval: 1.2, originalAttackInterval: 1.2, ranged: false, speedMultiplier: 1.8, description: '표준 돌격 기병' }),
  chariot: unit({ kind: 'chariot', name: '전차', symbol: 'C', family: 'cavalry', tier: 1, texture: 'chariot', hp: 45, damage: 4, originalDamage: 1, cost: 15, rangeTiles: 1, attackInterval: .6, originalAttackInterval: .15, ranged: false, speedMultiplier: 1.8, description: '높은 체력과 빠른 연속 공격' }),
  wingedHussar: unit({ kind: 'wingedHussar', name: '윙드 후사르', symbol: 'W', family: 'cavalry', tier: 1, texture: 'wingedHussar', hp: 27, damage: 9, originalDamage: 9, cost: 13, rangeTiles: 2, attackInterval: 1.2, originalAttackInterval: 1.2, ranged: false, speedMultiplier: 1.8, description: '기병 속도로 시작해 2.4배까지 가속, 돌격 피해 최대 20%' }),
  dragoon: unit({ kind: 'dragoon', name: '드라군', symbol: 'D', family: 'cavalry', tier: 1, texture: 'dragoon', hp: 25, damage: 8, originalDamage: 8, cost: 15, rangeTiles: 6, attackInterval: 2, originalAttackInterval: 2, ranged: true, speedMultiplier: 1.8, description: '원거리 총과 근거리 검을 전환' }),

  fenrir: unit({ kind: 'fenrir', name: '펜리르 늑대전사', symbol: 'L', family: 'special', tier: 1, texture: 'fenrir', hp: 12, damage: 6, originalDamage: 4, cost: 4, rangeTiles: 1, attackInterval: .75, originalAttackInterval: .5, ranged: false, speedMultiplier: 1.8, description: '원거리 병종의 천적' }),
  ronin: unit({ kind: 'ronin', name: '로닌', symbol: 'R', family: 'special', tier: 1, texture: 'ronin', hp: 22, damage: 10, originalDamage: 10, cost: 8, rangeTiles: 1, attackInterval: 1, originalAttackInterval: 1, ranged: false, speedMultiplier: 1, description: '선딜 없이 돌진해 첫 공격이 2배인 발도술' }),
  viking: unit({ kind: 'viking', name: '바이킹 광전사', symbol: 'V', family: 'special', tier: 2, texture: 'viking', hp: 70, damage: 19, originalDamage: 14, cost: 35, rangeTiles: 1, attackInterval: .75, originalAttackInterval: .55, ranged: false, speedMultiplier: 1.8, description: '흡혈과 7초 광폭화', eliteCooldown: 30 }),
  sanada: unit({ kind: 'sanada', name: '사나다 사무라이', symbol: 'Y', family: 'special', tier: 2, texture: 'sanada', hp: 60, damage: 22, originalDamage: 18, cost: 45, rangeTiles: 1, attackInterval: .9, originalAttackInterval: .75, ranged: false, speedMultiplier: 1.8, description: '기병식 돌격 가속과 2초 패링', eliteCooldown: 35 }),
};

export const UNIT_LIST = Object.values(UNITS);
