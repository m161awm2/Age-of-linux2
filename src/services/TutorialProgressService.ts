import { PlayerProgressService } from './PlayerProgressService';

const TUTORIAL_COMPLETE_KEY = 'age-of-linux2-tutorial-complete';

export type MenuTutorialStep = 'shop' | 'settings' | 'codex' | 'rank' | 'gameStart' | 'campaign' | 'easy';

export class TutorialProgressService {
  private static sessionComplete = false;
  private static menuStep: MenuTutorialStep | null = null;

  static isComplete(): boolean {
    if (this.sessionComplete) return true;
    if (PlayerProgressService.current.tutorialCompleted) return true;
    try { return window.localStorage.getItem(TUTORIAL_COMPLETE_KEY) === 'true'; }
    catch { return false; }
  }

  static complete(): void {
    this.sessionComplete = true;
    this.menuStep = null;

    try { window.localStorage.setItem(TUTORIAL_COMPLETE_KEY, 'true'); }
    catch { /* 저장소를 사용할 수 없어도 현재 플레이는 계속 허용한다. */ }

    void PlayerProgressService.completeTutorial().catch((error) => {
      console.warn('계정 튜토리얼 완료 상태를 저장하지 못했습니다.', error);
    });
  }

  static beginMenuWalkthrough(): void {
    // 진행도 RPC가 아직 배포되지 않은 환경에서는 구매 단계가 게임 진입을 막지 않게 한다.
    this.menuStep = PlayerProgressService.isLoaded ? 'shop' : 'settings';
  }

  static getMenuStep(): MenuTutorialStep | null {
    return this.menuStep;
  }

  static setMenuStep(step: MenuTutorialStep): void {
    this.menuStep = step;
  }

  static resetForAccount(): void {
    this.sessionComplete = false;
    this.menuStep = null;
  }
}
