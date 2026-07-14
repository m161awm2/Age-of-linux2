const TUTORIAL_COMPLETE_KEY = 'age-of-linux2-tutorial-complete';

export class TutorialProgressService {
  private static sessionComplete = false;

  static isComplete(): boolean {
    if (this.sessionComplete) return true;

    try { return window.localStorage.getItem(TUTORIAL_COMPLETE_KEY) === 'true'; }
    catch { return false; }
  }

  static complete(): void {
    this.sessionComplete = true;

    try { window.localStorage.setItem(TUTORIAL_COMPLETE_KEY, 'true'); }
    catch { /* 저장소를 사용할 수 없어도 현재 플레이는 계속 허용한다. */ }
  }
}
