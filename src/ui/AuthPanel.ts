import { AuthService } from '../services/AuthService';

type AuthMode = 'login' | 'signup';

export class AuthPanel {
  private readonly root: HTMLDivElement;
  private readonly form: HTMLFormElement;
  private readonly title: HTMLHeadingElement;
  private readonly submit: HTMLButtonElement;
  private readonly status: HTMLParagraphElement;
  private mode: AuthMode = 'login';

  constructor(private readonly onAuthenticated: () => void) {
    this.root = document.createElement('div');
    this.root.className = 'auth-screen';
    this.root.innerHTML = `
      <section class="auth-card" aria-labelledby="auth-title">
        <p class="auth-kicker">AGE OF LINUX2</p>
        <h1 id="auth-title">전장 로그인</h1>
        <p class="auth-description">게임을 플레이하려면 로그인이 필요합니다.</p>
        <div class="auth-tabs" role="tablist" aria-label="로그인 방식">
          <button class="active" type="button" data-mode="login">로그인</button>
          <button type="button" data-mode="signup">회원가입</button>
        </div>
        <form class="auth-form">
          <label>
            <span>아이디</span>
            <input name="loginId" type="text" minlength="4" maxlength="16" pattern="[A-Za-z0-9_]+" autocomplete="username" placeholder="영문·숫자·_ 4~16자" required>
          </label>
          <label>
            <span>비밀번호</span>
            <input name="password" type="password" minlength="6" maxlength="72" autocomplete="current-password" placeholder="6자 이상" required>
          </label>
          <p class="auth-status" role="status" aria-live="polite"></p>
          <button class="auth-submit" type="submit">전장 입장</button>
        </form>
        <small>아이디와 비밀번호는 로그인에만 사용됩니다.</small>
      </section>`;
    document.body.appendChild(this.root);
    this.form = this.root.querySelector<HTMLFormElement>('.auth-form')!;
    this.title = this.root.querySelector<HTMLHeadingElement>('#auth-title')!;
    this.submit = this.root.querySelector<HTMLButtonElement>('.auth-submit')!;
    this.status = this.root.querySelector<HTMLParagraphElement>('.auth-status')!;
    this.root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => {
      button.addEventListener('click', () => this.setMode(button.dataset.mode as AuthMode));
    });
    this.form.addEventListener('submit', (event) => void this.handleSubmit(event));
    this.root.querySelector<HTMLInputElement>('input')?.focus();
  }

  destroy(): void { this.root.remove(); }

  private setMode(mode: AuthMode): void {
    this.mode = mode;
    this.title.textContent = mode === 'login' ? '전장 로그인' : '전사 등록';
    this.submit.textContent = mode === 'login' ? '전장 입장' : '회원가입';
    this.status.textContent = '';
    this.status.className = 'auth-status';
    const password = this.form.elements.namedItem('password') as HTMLInputElement;
    password.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    this.root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => {
      button.classList.toggle('active', button.dataset.mode === mode);
    });
  }

  private async handleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const formData = new FormData(this.form);
    const loginId = String(formData.get('loginId') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    if (!AuthService.isValidLoginId(loginId)) {
      this.showStatus('아이디는 영문, 숫자, _를 사용해 4~16자로 입력하세요.', true);
      return;
    }
    if (password.length < 6) {
      this.showStatus('비밀번호는 6자 이상 입력하세요.', true);
      return;
    }

    this.setBusy(true);
    this.showStatus(this.mode === 'login' ? '로그인 중…' : '계정을 만드는 중…');
    try {
      if (this.mode === 'login') {
        await AuthService.signIn(loginId, password);
      } else {
        const result = await AuthService.signUp(loginId, password);
        if (result.requiresEmailConfirmation) {
          this.showStatus('Supabase에서 Confirm email을 꺼야 아이디 회원가입을 사용할 수 있습니다.', true);
          return;
        }
        if (!result.signedIn) throw new Error('회원가입 후 로그인 세션을 만들지 못했습니다.');
      }
      this.showStatus('인증되었습니다. 전장으로 이동합니다.');
      this.onAuthenticated();
    } catch (error) {
      this.showStatus(this.toKoreanError(error), true);
    } finally {
      this.setBusy(false);
    }
  }

  private setBusy(busy: boolean): void {
    this.submit.disabled = busy;
    this.root.querySelectorAll<HTMLInputElement>('input').forEach((input) => { input.disabled = busy; });
    this.root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => { button.disabled = busy; });
  }

  private showStatus(message: string, error = false): void {
    this.status.textContent = message;
    this.status.classList.toggle('error', error);
  }

  private toKoreanError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    if (/invalid login credentials/i.test(message)) return '아이디 또는 비밀번호가 올바르지 않습니다.';
    if (/user already registered/i.test(message)) return '이미 사용 중인 아이디입니다.';
    if (/password/i.test(message) && /least|short|characters/i.test(message)) return '비밀번호가 너무 짧습니다. 6자 이상 입력하세요.';
    if (/rate limit/i.test(message)) return '요청이 너무 많습니다. 잠시 후 다시 시도하세요.';
    return message || '인증 중 오류가 발생했습니다.';
  }
}
