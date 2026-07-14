import { AudioService } from '../services/AudioService';

export class SettingsPanel {
  private readonly root: HTMLDivElement;
  private readonly volumeValue: HTMLOutputElement;

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'settings-modal';
    this.root.setAttribute('aria-hidden', 'true');
    const volume = Math.round(AudioService.getVolume() * 100);
    this.root.innerHTML = `
      <section class="settings-card" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <button class="settings-close" type="button" aria-label="설정 닫기">×</button>
        <p class="settings-kicker">AGE OF LINUX2</p>
        <h2 id="settings-title">설정</h2>
        <label class="volume-setting">
          <span><strong>배경음악 음량</strong><output>${volume}%</output></span>
          <input type="range" min="0" max="100" step="1" value="${volume}" aria-label="배경음악 음량">
          <small>슬라이더를 맨 왼쪽으로 옮기면 음악이 음소거됩니다.</small>
        </label>
      </section>`;
    document.body.appendChild(this.root);
    this.volumeValue = this.root.querySelector<HTMLOutputElement>('output')!;
    const slider = this.root.querySelector<HTMLInputElement>('input[type="range"]')!;
    slider.addEventListener('input', () => {
      const nextVolume = Number(slider.value);
      this.volumeValue.value = `${nextVolume}%`;
      this.volumeValue.textContent = `${nextVolume}%`;
      AudioService.setVolume(nextVolume / 100);
    });
    this.root.querySelector('.settings-close')?.addEventListener('click', () => this.close());
    this.root.addEventListener('pointerdown', (event) => { if (event.target === this.root) this.close(); });
  }

  open(): void {
    this.root.classList.add('visible');
    this.root.setAttribute('aria-hidden', 'false');
    this.root.querySelector<HTMLInputElement>('input')?.focus();
  }

  close(): void {
    this.root.classList.remove('visible');
    this.root.setAttribute('aria-hidden', 'true');
  }

  destroy(): void { this.root.remove(); }
}
