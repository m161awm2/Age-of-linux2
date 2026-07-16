const TUTORIAL_COMPLETE_KEY = 'age-of-linux2-tutorial-complete';

export type MenuTutorialStep = 'settings' | 'codex' | 'rank' | 'gameStart' | 'campaign' | 'easy';

export class TutorialProgressService {
  private static sessionComplete = false;
  private static menuStep: MenuTutorialStep | null = null;

  static isComplete(): boolean {
    if (this.sessionComplete) return true;

    try { return window.localStorage.getItem(TUTORIAL_COMPLETE_KEY) === 'true'; }
    catch { return false; }
  }

  static complete(): void {
    this.sessionComplete = true;
    this.menuStep = null;

    try { window.localStorage.setItem(TUTORIAL_COMPLETE_KEY, 'true'); }
    catch { /* 저장소를 사용할 수 없어도 현재 플레이는 계속 허용한다. */ }
  }

  static beginMenuWalkthrough(): void {
    this.menuStep = 'settings';
  }

  static getMenuStep(): MenuTutorialStep | null {
    return this.menuStep;
  }

  static setMenuStep(step: MenuTutorialStep): void {
    this.menuStep = step;
  }
}
