import Phaser from 'phaser';

const VOLUME_KEY = 'age-of-linux2-bgm-volume';
const DEFAULT_VOLUME = .45;
type AdjustableSound = Phaser.Sound.BaseSound & { setVolume(value: number): Phaser.Sound.BaseSound };

export class AudioService {
  private static bgm?: AdjustableSound;

  static prepare(scene: Phaser.Scene): void {
    if (!this.bgm) {
      this.bgm = scene.sound.add('bgm', { loop: true, volume: this.getVolume() }) as AdjustableSound;
    }
    this.bgm.setVolume(this.getVolume());
    if (this.bgm.isPlaying) return;
    if (!scene.sound.locked) {
      this.bgm.play();
      return;
    }
    scene.input.once(Phaser.Input.Events.POINTER_DOWN, () => {
      if (!scene.sound.locked) this.play();
      else scene.sound.once(Phaser.Sound.Events.UNLOCKED, () => this.play());
    });
  }

  static getVolume(): number {
    const stored = Number(window.localStorage.getItem(VOLUME_KEY));
    return Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : DEFAULT_VOLUME;
  }

  static setVolume(volume: number): void {
    const normalized = Phaser.Math.Clamp(volume, 0, 1);
    window.localStorage.setItem(VOLUME_KEY, normalized.toString());
    this.bgm?.setVolume(normalized);
  }

  private static play(): void {
    if (this.bgm && !this.bgm.isPlaying) this.bgm.play();
  }
}
