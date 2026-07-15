import { PvpRoomService, type PvpRoom } from '../services/PvpRoomService';

export class OnlineLobbyPanel {
  private readonly root: HTMLDivElement;
  private readonly createView: HTMLElement;
  private readonly joinView: HTMLElement;
  private readonly roomView: HTMLElement;
  private readonly status: HTMLParagraphElement;
  private readonly joinInput: HTMLInputElement;
  private refreshTimer: number | null = null;
  private battleTimer: number | null = null;
  private room: PvpRoom | null = null;
  private busy = false;
  private battleStarting = false;

  constructor(private readonly onBack: () => void, private readonly onBattle: (room: PvpRoom) => void) {
    this.root = document.createElement('div');
    this.root.className = 'online-lobby-screen';
    this.root.innerHTML = `
      <section class="online-lobby-card" aria-labelledby="online-lobby-title">
        <button class="online-back" type="button" aria-label="메인 메뉴로 돌아가기">← 메인 메뉴</button>
        <p class="online-kicker">ONLINE BATTLE</p>
        <h1 id="online-lobby-title">1대1 모드</h1>
        <p class="online-description">방을 만들거나 상대의 코드를 입력해 같은 전장에 입장하세요.</p>
        <div class="online-tabs" role="tablist" aria-label="1대1 방 메뉴">
          <button class="active" type="button" data-tab="create">방 만들기</button>
          <button type="button" data-tab="join">코드로 참가</button>
        </div>
        <div class="online-view" data-view="create">
          <div class="online-mode-icon">⚔</div>
          <h2>새 방 생성</h2>
          <p>6자리 코드가 발급됩니다. 코드를 상대에게 공유하세요.</p>
          <button class="online-primary" type="button" data-action="create">방 만들기</button>
        </div>
        <form class="online-view hidden" data-view="join">
          <div class="online-mode-icon">⚑</div>
          <h2>방 참가</h2>
          <p>방장에게 받은 6자리 코드를 입력하세요.</p>
          <input name="roomCode" type="text" inputmode="text" minlength="6" maxlength="6" pattern="[A-Fa-f0-9]{6}" autocomplete="off" placeholder="A7C2F9" aria-label="방 코드" required>
          <button class="online-primary" type="submit">방 참가</button>
        </form>
        <div class="online-room hidden" data-view="room">
          <p class="room-role"></p>
          <span class="room-code-label">방 코드</span>
          <button class="room-code" type="button" title="클릭해서 복사"></button>
          <div class="room-players">
            <div><span>1P</span><strong class="room-host"></strong><small>방장</small></div>
            <b>VS</b>
            <div><span>2P</span><strong class="room-guest"></strong><small class="room-guest-state"></small></div>
          </div>
          <p class="room-waiting"></p>
          <button class="online-secondary" type="button" data-action="leave">방 나가기</button>
        </div>
        <p class="online-status" role="status" aria-live="polite"></p>
      </section>`;
    document.body.appendChild(this.root);
    this.createView = this.root.querySelector<HTMLElement>('[data-view="create"]')!;
    this.joinView = this.root.querySelector<HTMLElement>('[data-view="join"]')!;
    this.roomView = this.root.querySelector<HTMLElement>('[data-view="room"]')!;
    this.status = this.root.querySelector<HTMLParagraphElement>('.online-status')!;
    this.joinInput = this.root.querySelector<HTMLInputElement>('input[name="roomCode"]')!;

    this.root.querySelector<HTMLButtonElement>('.online-back')!.addEventListener('click', () => void this.goBack());
    this.root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((button) => {
      button.addEventListener('click', () => this.setTab(button.dataset.tab === 'join' ? 'join' : 'create'));
    });
    this.root.querySelector<HTMLButtonElement>('[data-action="create"]')!.addEventListener('click', () => void this.createRoom());
    this.root.querySelector<HTMLFormElement>('form[data-view="join"]')!.addEventListener('submit', (event) => void this.joinRoom(event));
    this.root.querySelector<HTMLButtonElement>('[data-action="leave"]')!.addEventListener('click', () => void this.leaveRoom());
    this.root.querySelector<HTMLButtonElement>('.room-code')!.addEventListener('click', () => void this.copyCode());
    this.joinInput.addEventListener('input', () => { this.joinInput.value = this.joinInput.value.toUpperCase().replace(/[^A-F0-9]/g, ''); });
  }

  destroy(): void {
    this.stopRefreshing();
    if (this.battleTimer !== null) window.clearTimeout(this.battleTimer);
    this.root.remove();
  }

  async exit(): Promise<void> { await this.goBack(); }

  private setTab(tab: 'create' | 'join'): void {
    if (this.room) return;
    this.createView.classList.toggle('hidden', tab !== 'create');
    this.joinView.classList.toggle('hidden', tab !== 'join');
    this.root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((button) => {
      button.classList.toggle('active', button.dataset.tab === tab);
    });
    this.showStatus('');
    if (tab === 'join') this.joinInput.focus();
  }

  private async createRoom(): Promise<void> {
    if (this.busy) return;
    this.setBusy(true);
    this.showStatus('방을 만드는 중…');
    try {
      this.showRoom(await PvpRoomService.createRoom());
    } catch (error) {
      this.showStatus(this.formatError(error), true);
    } finally {
      this.setBusy(false);
    }
  }

  private async joinRoom(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (this.busy) return;
    this.setBusy(true);
    this.showStatus('방에 입장하는 중…');
    try {
      this.showRoom(await PvpRoomService.joinRoom(this.joinInput.value));
    } catch (error) {
      this.showStatus(this.formatError(error), true);
    } finally {
      this.setBusy(false);
    }
  }

  private showRoom(room: PvpRoom): void {
    this.room = room;
    this.createView.classList.add('hidden');
    this.joinView.classList.add('hidden');
    this.roomView.classList.remove('hidden');
    this.root.querySelector<HTMLElement>('.online-tabs')!.classList.add('hidden');
    this.root.querySelector<HTMLElement>('.room-role')!.textContent = room.is_host ? '방을 만들었습니다' : '방에 참가했습니다';
    this.root.querySelector<HTMLButtonElement>('.room-code')!.textContent = room.code;
    this.renderRoom(room);
    this.showStatus('');
    this.stopRefreshing();
    this.refreshTimer = window.setInterval(() => void this.refreshRoom(), 1500);
  }

  private renderRoom(room: PvpRoom): void {
    this.root.querySelector<HTMLElement>('.room-host')!.textContent = room.host_login_id || '방장';
    this.root.querySelector<HTMLElement>('.room-guest')!.textContent = room.guest_login_id || '빈자리';
    this.root.querySelector<HTMLElement>('.room-guest-state')!.textContent = room.guest_user_id ? '참가 완료' : '입장 대기';
    this.root.querySelector<HTMLElement>('.room-waiting')!.textContent = room.guest_user_id
      ? '상대가 입장했습니다. 전투를 시작합니다…'
      : '상대의 입장을 기다리는 중…';
    this.roomView.classList.toggle('room-full', Boolean(room.guest_user_id));
    if (room.status === 'full' && room.guest_user_id) this.scheduleBattle(room);
  }

  private scheduleBattle(room: PvpRoom): void {
    if (this.battleStarting) return;
    this.battleStarting = true;
    this.stopRefreshing();
    this.battleTimer = window.setTimeout(() => {
      this.battleTimer = null;
      this.onBattle(room);
    }, 900);
  }

  private async refreshRoom(): Promise<void> {
    if (!this.room || this.busy) return;
    try {
      const room = await PvpRoomService.getRoom(this.room.id);
      if (room.status === 'cancelled') {
        this.showStatus('방이 종료되었습니다.', true);
        this.resetRoom();
        return;
      }
      this.room = room;
      this.renderRoom(room);
    } catch (error) {
      this.showStatus(this.formatError(error), true);
    }
  }

  private async leaveRoom(): Promise<void> {
    if (!this.room || this.busy) return;
    this.setBusy(true);
    try {
      await PvpRoomService.leaveRoom(this.room.id);
      this.resetRoom();
      this.showStatus('방에서 나왔습니다.');
    } catch (error) {
      this.showStatus(this.formatError(error), true);
    } finally {
      this.setBusy(false);
    }
  }

  private async goBack(): Promise<void> {
    if (this.busy) return;
    this.setBusy(true);
    if (this.room) {
      try { await PvpRoomService.leaveRoom(this.room.id); }
      catch { /* 화면 이동은 막지 않는다. */ }
    }
    this.onBack();
  }

  private resetRoom(): void {
    this.stopRefreshing();
    this.room = null;
    this.roomView.classList.add('hidden');
    this.root.querySelector<HTMLElement>('.online-tabs')!.classList.remove('hidden');
    this.createView.classList.remove('hidden');
    this.joinView.classList.add('hidden');
    this.setTab('create');
  }

  private async copyCode(): Promise<void> {
    if (!this.room) return;
    try {
      await navigator.clipboard.writeText(this.room.code);
      this.showStatus('방 코드를 복사했습니다.');
    } catch {
      this.showStatus(`방 코드: ${this.room.code}`);
    }
  }

  private stopRefreshing(): void {
    if (this.refreshTimer !== null) window.clearInterval(this.refreshTimer);
    this.refreshTimer = null;
  }

  private setBusy(busy: boolean): void {
    this.busy = busy;
    this.root.querySelectorAll<HTMLButtonElement>('button').forEach((button) => { button.disabled = busy; });
    this.joinInput.disabled = busy;
  }

  private showStatus(message: string, error = false): void {
    this.status.textContent = message;
    this.status.classList.toggle('error', error);
  }

  private formatError(error: unknown): string {
    const record = error && typeof error === 'object' ? error as Record<string, unknown> : null;
    const message = [
      error instanceof Error ? error.message : '',
      record?.message,
      record?.details,
      record?.hint,
    ].find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim() ?? '';
    const code = typeof record?.code === 'string' ? record.code : '';

    if (/schema cache|could not find the function/i.test(message) || code === 'PGRST202') {
      return '1대1 방 DB 설정이 필요합니다.';
    }
    if (/jwt|not authenticated|로그인이 필요/i.test(message) || code === 'PGRST301') {
      return '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.';
    }
    if (/permission denied|insufficient privilege/i.test(message) || code === '42501') {
      return '방 생성 권한이 없습니다. DB 권한 설정을 확인해 주세요.';
    }
    return message || (code ? `방 처리 중 오류가 발생했습니다. (${code})` : '방 처리 중 오류가 발생했습니다.');
  }
}
