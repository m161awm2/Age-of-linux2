import { BASE_MOVE_SPEED, BASE_STOP_DISTANCE, ENEMY_BASE_X, PLAYER_BASE_X } from '../data/constants';
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
      // 일반 공격 모션 중에도 전진한다. 공격 애니메이션과 적중 프레임은
      // CombatUnit의 attack lock이 유지하며, 채널링 공격은 이동 속도가
      // 30% 감소한 채 계속 전진한다.
      const allyAhead = index > 0 ? alive[index - 1] : undefined;
      const enemyAhead = liveEnemies[0];
      const direction = unit.team === 'player' ? 1 : -1;
      const allyGap = allyAhead ? direction * (allyAhead.x - unit.x) : Number.POSITIVE_INFINITY;
      const allySpacing = allyAhead ? unit.collisionRadius + allyAhead.collisionRadius : 0;
      // 간격 경계에서 매 프레임 move/idle이 뒤집히면 서로 다른 자세가 반복 재시작되어
      // 유닛이 위아래로 튀는 것처럼 보인다. 정지/출발 기준을 분리해 상태 떨림을 막는다.
      const spacingBuffer = 6;
      const blockedByAlly = allyAhead
        ? allyGap < allySpacing + (this.allyBlocked.has(unit) ? spacingBuffer : -spacingBuffer)
        : false;
      if (blockedByAlly) this.allyBlocked.add(unit);
      else this.allyBlocked.delete(unit);
      const enemySpacing = enemyAhead ? unit.collisionRadius + enemyAhead.collisionRadius + 6 : 0;
      const blockedByEnemy = enemyAhead ? Math.abs(enemyAhead.x - unit.x) < enemySpacing : false;
      const baseX = unit.team === 'player' ? ENEMY_BASE_X : PLAYER_BASE_X;
      const blockedByBase = Math.abs(unit.x - baseX) <= BASE_STOP_DISTANCE;

      if (blockedByAlly || blockedByEnemy || blockedByBase) {
        unit.playState('idle');
        if (blockedByAlly) unit.resetCharge(now);
        return;
      }

      const attackMoveMultiplier = unit.isChanneling ? .7 : 1;
      const distance = BASE_MOVE_SPEED * unit.speedMultiplier(now) * attackMoveMultiplier * deltaSeconds;
      unit.x += direction * distance;
      unit.addCharge(distance);
      unit.playState('move');
    });
  }

  private frontSort(team: Team): (a: CombatUnit, b: CombatUnit) => number {
    return team === 'player' ? (a, b) => b.x - a.x : (a, b) => a.x - b.x;
  }
}
