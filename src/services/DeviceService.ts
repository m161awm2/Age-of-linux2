export class DeviceService {
  static isMobile(): boolean {
    const mobileAgent = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(navigator.userAgent);
    const coarseTouch = window.matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0;
    const compactScreen = Math.min(window.screen.width, window.screen.height) < 900;
    return mobileAgent || (coarseTouch && compactScreen);
  }

  static setupOrientationGuard(): void {
    const mobile = this.isMobile();
    document.documentElement.classList.toggle('mobile-device', mobile);
    const overlay = document.getElementById('orientation-lock');
    if (!overlay) return;
    const update = () => {
      const portrait = window.innerHeight > window.innerWidth;
      overlay.classList.toggle('visible', mobile && portrait);
      overlay.setAttribute('aria-hidden', String(!(mobile && portrait)));
    };
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    overlay.querySelector('button')?.addEventListener('click', () => void this.requestLandscape());
    update();
  }

  private static async requestLandscape(): Promise<void> {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      const orientation = window.screen.orientation as ScreenOrientation & { lock?: (orientation: 'landscape') => Promise<void> };
      await orientation.lock?.('landscape');
    } catch {
      // iOS Safari 등 잠금을 지원하지 않는 브라우저는 안내 화면을 유지한다.
    }
  }
}
