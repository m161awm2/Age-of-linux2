import { ALLY_SPACING, BASE_MOVE_SPEED, BASE_STOP_DISTANCE, ENEMY_BASE_X, ENEMY_STOP_DISTANCE, PLAYER_BASE_X } from '../data/constants';
import type { Team } from '../data/types';
import type { CombatUnit } from '../entities/CombatUnit';

export class MovementSystem {
  private readonly allyBlocked = new WeakSet<CombatUnit>();

  update(
    units: CombatUnit[],
    enemies: CombatUnit[],
    deltaSeconds: number,
    now: number,
  ): void {
    const alive = units.filter((unit) => unit.alive).sort(this.frontSort(units[0]?.team ?? 'player'));
    const liveEnemies = enemies.filter((unit) => unit.alive).sort(this.frontSort(enemies[0]?.team ?? 'enemy'));

    alive.forEach((unit, index) => {
      if (unit.isStunned) {
        unit.playState('idle');
        return;
      }
      const allyAhead = index > 0 ? alive[index - 1] : undefined;
      const enemyAhead = liveEnemies[0];
      const direction = unit.team === 'player' ? 1 : -1;
      const allyGap = allyAhead ? direction * (allyAhead.x - unit.x) : Number.POSITIVE_INFINITY;
      // 간격 경계에서 매 프레임 move/idle이 뒤집히면 서로 다른 자세가 반복 재시작되어
      // 유닛이 위아래로 튀는 것처럼 보인다. 정지/출발 기준을 분리해 상태 떨림을 막는다.
      const spacingBuffer = 6;
      const blockedByAlly = allyAhead
        ? allyGap < ALLY_SPACING + (this.allyBlocked.has(unit) ? spacingBuffer : -spacingBuffer)
        : false;
      if (blockedByAlly) this.allyBlocked.add(unit);
      else this.allyBlocked.delete(unit);
      const blockedByEnemy = enemyAhead ? Math.abs(enemyAhead.x - unit.x) < ENEMY_STOP_DISTANCE : false;
      const baseX = unit.team === 'player' ? ENEMY_BASE_X : PLAYER_BASE_X;
      const blockedByBase = Math.abs(unit.x - baseX) <= BASE_STOP_DISTANCE;

      if (blockedByAlly || blockedByEnemy || blockedByBase) {
        unit.playState('idle');
        if (blockedByAlly) unit.resetCharge(now);
        return;
      }

      const distance = BASE_MOVE_SPEED * unit.speedMultiplier(now) * deltaSeconds;
      unit.x += direction * distance;
      unit.addCharge(distance);
      unit.playState('move');
    });
  }

  private frontSort(team: Team): (a: CombatUnit, b: CombatUnit) => number {
    return team === 'player' ? (a, b) => b.x - a.x : (a, b) => a.x - b.x;
  }
}
