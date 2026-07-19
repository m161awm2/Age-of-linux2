import { AudioService } from '../services/AudioService';
import { PresenceService, type OnlineUserPresence } from '../services/PresenceService';

export class SettingsPanel {
  private readonly root: HTMLDivElement;
  private readonly volumeValue: HTMLOutputElement;
  private readonly onlineCount: HTMLOutputElement;
  private readonly onlineDetails: HTMLDivElement;
  private readonly onlineStatus: HTMLParagraphElement;
  private readonly detailButton: HTMLButtonElement;
  private refreshTimer: number | null = null;

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
        <section class="online-users-setting" aria-labelledby="online-users-title">
          <div class="online-users-summary">
            <span><i aria-hidden="true"></i><strong id="online-users-title">온라인 유저</strong></span>
            <output>조회 중…</output>
          </div>
          <p>최근 2분 동안 활동한 유저를 표시합니다.</p>
          <button type="button" data-action="toggle-online-details" aria-expanded="false">자세히 보기</button>
          <div class="online-user-details hidden"></div>
          <p class="online-users-status" role="status" aria-live="polite"></p>
        </section>
      </section>`;
    document.body.appendChild(this.root);
    this.volumeValue = this.root.querySelector<HTMLOutputElement>('output')!;
    this.onlineCount = this.root.querySelector<HTMLOutputElement>('.online-users-summary output')!;
    this.onlineDetails = this.root.querySelector<HTMLDivElement>('.online-user-details')!;
    this.onlineStatus = this.root.querySelector<HTMLParagraphElement>('.online-users-status')!;
    this.detailButton = this.root.querySelector<HTMLButtonElement>('[data-action="toggle-online-details"]')!;
    const slider = this.root.querySelector<HTMLInputElement>('input[type="range"]')!;
    slider.addEventListener('input', () => {
      const nextVolume = Number(slider.value);
      this.volumeValue.value = `${nextVolume}%`;
      this.volumeValue.textContent = `${nextVolume}%`;
      AudioService.setVolume(nextVolume / 100);
    });
    this.root.querySelector('.settings-close')?.addEventListener('click', () => this.close());
    this.detailButton.addEventListener('click', () => {
      const expanded = this.onlineDetails.classList.toggle('hidden') === false;
      this.detailButton.setAttribute('aria-expanded', String(expanded));
      this.detailButton.textContent = expanded ? '간단히 보기' : '자세히 보기';
      if (expanded) void this.loadOnlineUsers();
    });
    this.root.addEventListener('pointerdown', (event) => { if (event.target === this.root) this.close(); });
  }

  open(): void {
    this.root.classList.add('visible');
    this.root.setAttribute('aria-hidden', 'false');
    this.root.querySelector<HTMLInputElement>('input')?.focus();
    void this.loadOnlineUsers();
    if (this.refreshTimer !== null) window.clearInterval(this.refreshTimer);
    this.refreshTimer = window.setInterval(() => void this.loadOnlineUsers(), 30_000);
  }

  close(): void {
    this.root.classList.remove('visible');
    this.root.setAttribute('aria-hidden', 'true');
    if (this.refreshTimer !== null) window.clearInterval(this.refreshTimer);
    this.refreshTimer = null;
  }

  destroy(): void {
    if (this.refreshTimer !== null) window.clearInterval(this.refreshTimer);
    this.root.remove();
  }

  private async loadOnlineUsers(): Promise<void> {
    this.onlineStatus.textContent = '온라인 상태를 불러오는 중…';
    try {
      const users = await PresenceService.getOnlineUsers();
      this.onlineCount.value = `${users.length}명 접속 중`;
      this.onlineCount.textContent = `${users.length}명 접속 중`;
      this.renderOnlineUsers(users);
      this.onlineStatus.textContent = '';
    } catch (error) {
      console.warn('온라인 유저 조회 실패', error);
      this.onlineCount.value = '조회 실패';
      this.onlineCount.textContent = '조회 실패';
      this.onlineDetails.replaceChildren();
      this.onlineStatus.textContent = '온라인 유저 DB 설정이 필요하거나 연결할 수 없습니다.';
    }
  }

  private renderOnlineUsers(users: OnlineUserPresence[]): void {
    this.onlineDetails.replaceChildren();
    if (users.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'online-users-empty';
      empty.textContent = '현재 온라인인 유저가 없습니다.';
      this.onlineDetails.appendChild(empty);
      return;
    }
    const list = document.createElement('ul');
    users.forEach((user) => {
      const item = document.createElement('li');
      const identity = document.createElement('span');
      const dot = document.createElement('i');
      const name = document.createElement('strong');
      name.textContent = user.is_me ? `${user.login_id} (나)` : user.login_id;
      identity.append(dot, name);
      const time = document.createElement('time');
      time.dateTime = user.last_seen_at;
      time.textContent = `마지막 활동 ${this.formatLastSeen(user.last_seen_at)}`;
      item.append(identity, time);
      list.appendChild(item);
    });
    this.onlineDetails.appendChild(list);
  }

  private formatLastSeen(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '알 수 없음';
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(date);
  }
}
