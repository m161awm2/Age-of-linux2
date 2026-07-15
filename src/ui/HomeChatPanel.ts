import { ChatService, type ChatAnnouncement, type ChatMessage } from '../services/ChatService';
import { AuthService } from '../services/AuthService';

export class HomeChatPanel {
  private readonly root: HTMLElement;
  private readonly messageList: HTMLDivElement;
  private readonly form: HTMLFormElement;
  private readonly input: HTMLInputElement;
  private readonly submit: HTMLButtonElement;
  private readonly status: HTMLParagraphElement;
  private readonly announcement: HTMLElement;
  private readonly announcementForm: HTMLFormElement;
  private readonly announcementInput: HTMLInputElement;
  private readonly refreshTimer: number;
  private loading = false;

  constructor() {
    this.root = document.createElement('aside');
    this.root.className = 'home-chat';
    this.root.setAttribute('aria-label', '팁 공유 채팅');
    this.root.innerHTML = `
      <header>
        <strong>전장 팁 채팅</strong>
        <span class="chat-live">LIVE</span><button class="chat-toggle" type="button" aria-label="채팅 열기">⌃</button>
      </header>
      <p class="chat-description">팁 공유를 위한 채팅창입니다</p>
      <section class="chat-announcement hidden" aria-live="polite">
        <div><span>공지</span><strong></strong><time></time></div><p></p>
      </section>
      <form class="chat-announcement-form hidden">
        <input name="announcement" type="text" maxlength="200" autocomplete="off" placeholder="채팅 상단 공지 작성" aria-label="채팅 공지">
        <button type="submit">공지</button><button type="button" data-action="clear-announcement">해제</button>
      </form>
      <div class="chat-messages" role="log" aria-live="polite"></div>
      <p class="chat-status" role="status"></p>
      <form class="chat-form">
        <input name="message" type="text" maxlength="200" autocomplete="off" placeholder="전투 팁을 입력하세요" aria-label="채팅 메시지" required>
        <button type="submit">전송</button>
      </form>`;
    document.body.appendChild(this.root);
    this.messageList = this.root.querySelector<HTMLDivElement>('.chat-messages')!;
    this.form = this.root.querySelector<HTMLFormElement>('.chat-form')!;
    this.input = this.form.querySelector<HTMLInputElement>('input')!;
    this.submit = this.form.querySelector<HTMLButtonElement>('button')!;
    this.status = this.root.querySelector<HTMLParagraphElement>('.chat-status')!;
    this.announcement = this.root.querySelector<HTMLElement>('.chat-announcement')!;
    this.announcementForm = this.root.querySelector<HTMLFormElement>('.chat-announcement-form')!;
    this.announcementInput = this.announcementForm.querySelector<HTMLInputElement>('input')!;
    this.root.querySelector<HTMLButtonElement>('.chat-toggle')?.addEventListener('click', () => {
      const expanded = this.root.classList.toggle('expanded');
      const toggle = this.root.querySelector<HTMLButtonElement>('.chat-toggle')!;
      toggle.textContent = expanded ? '⌄' : '⌃';
      toggle.setAttribute('aria-label', expanded ? '채팅 접기' : '채팅 열기');
      if (expanded) void this.refresh(true);
    });
    this.form.addEventListener('submit', (event) => void this.handleSubmit(event));
    this.announcementForm.addEventListener('submit', (event) => void this.handleAnnouncement(event));
    this.announcementForm.querySelector<HTMLButtonElement>('[data-action="clear-announcement"]')!
      .addEventListener('click', () => void this.clearAnnouncement());
    void this.configureAnnouncementEditor();
    void this.refresh(true);
    this.refreshTimer = window.setInterval(() => void this.refresh(), 4000);
  }

  destroy(): void {
    window.clearInterval(this.refreshTimer);
    this.root.remove();
  }

  private async refresh(forceScroll = false): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    const nearBottom = this.messageList.scrollHeight - this.messageList.scrollTop - this.messageList.clientHeight < 45;
    try {
      const [messages, announcement] = await Promise.all([ChatService.getMessages(), ChatService.getAnnouncement()]);
      this.renderMessages(messages);
      this.renderAnnouncement(announcement);
      this.status.textContent = '';
      if (forceScroll || nearBottom) this.messageList.scrollTop = this.messageList.scrollHeight;
    } catch (error) {
      console.warn('채팅 조회 실패', error);
      this.status.textContent = '채팅 서버를 준비 중이거나 연결할 수 없습니다.';
    } finally {
      this.loading = false;
    }
  }

  private async configureAnnouncementEditor(): Promise<void> {
    const loginId = (await AuthService.getLoginId())?.toLowerCase();
    this.announcementForm.classList.toggle('hidden', loginId !== 'admin' && loginId !== 'm161awm');
  }

  private renderAnnouncement(announcement: ChatAnnouncement | null): void {
    this.announcement.classList.toggle('hidden', !announcement);
    if (!announcement) return;
    this.announcement.querySelector<HTMLElement>('strong')!.textContent = announcement.login_id;
    this.announcement.querySelector<HTMLElement>('p')!.textContent = announcement.message;
    const time = this.announcement.querySelector<HTMLTimeElement>('time')!;
    time.dateTime = announcement.updated_at;
    time.textContent = this.formatTime(announcement.updated_at);
    if (!this.announcementForm.classList.contains('hidden') && document.activeElement !== this.announcementInput) {
      this.announcementInput.value = announcement.message;
    }
  }

  private async handleAnnouncement(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const message = this.announcementInput.value.trim();
    if (!message) { this.status.textContent = '공지 내용을 입력하세요.'; return; }
    await this.saveAnnouncement(message, '공지를 등록했습니다.');
  }

  private async clearAnnouncement(): Promise<void> {
    await this.saveAnnouncement('', '공지를 해제했습니다.');
    this.announcementInput.value = '';
  }

  private async saveAnnouncement(message: string, successMessage: string): Promise<void> {
    const controls = this.announcementForm.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button');
    controls.forEach((control) => { control.disabled = true; });
    this.status.textContent = '공지 처리 중…';
    try {
      await ChatService.setAnnouncement(message);
      await this.refresh();
      this.status.textContent = successMessage;
    } catch (error) {
      const text = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
      this.status.textContent = text || '공지 처리에 실패했습니다.';
    } finally {
      controls.forEach((control) => { control.disabled = false; });
    }
  }

  private renderMessages(messages: ChatMessage[]): void {
    this.messageList.replaceChildren();
    if (messages.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'chat-empty';
      empty.textContent = '아직 메시지가 없습니다. 첫 번째 팁을 남겨보세요!';
      this.messageList.appendChild(empty);
      return;
    }
    messages.forEach((item) => {
      const article = document.createElement('article');
      const featured = ['m161awm', 'admin'].includes(item.login_id.toLowerCase());
      article.className = ['chat-message', item.is_me ? 'mine' : '', featured ? 'featured' : ''].filter(Boolean).join(' ');
      const meta = document.createElement('div');
      const author = document.createElement('strong');
      author.textContent = item.is_me ? `${item.login_id} (나)` : item.login_id;
      if (featured) author.dataset.badge = 'ADMIN';
      const time = document.createElement('time');
      time.dateTime = item.created_at;
      time.textContent = this.formatTime(item.created_at);
      const body = document.createElement('p');
      body.textContent = item.message;
      meta.append(author, time);
      article.append(meta, body);
      this.messageList.appendChild(article);
    });
  }

  private async handleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const message = this.input.value.trim();
    if (!message) return;
    this.input.disabled = true;
    this.submit.disabled = true;
    this.status.textContent = '전송 중…';
    try {
      await ChatService.sendMessage(message);
      this.input.value = '';
      await this.refresh(true);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      this.status.textContent = /too fast|도배/i.test(messageText) ? '메시지는 2초에 한 번만 보낼 수 있습니다.' : '메시지 전송에 실패했습니다.';
    } finally {
      this.input.disabled = false;
      this.submit.disabled = false;
      this.input.focus();
    }
  }

  private formatTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit' }).format(date);
  }
}
