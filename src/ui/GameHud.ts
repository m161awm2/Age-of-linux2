import type { Difficulty, UnitDefinition } from '../data/types';

export type ProductionSlot = 'infantry' | 'archer' | 'cavalry' | 'special';
export type PromotionMode = 'normal' | 'special';

export interface PromotionOption {
  id: string;
  hotkey: string;
  label: string;
  cost: number;
  description: string;
  disabled: boolean;
}

export interface HudState {
  gold: number;
  playerBaseHp: number;
  playerBaseMaxHp: number;
  enemyBaseHp: number;
  enemyBaseMaxHp: number;
  difficulty: Difficulty;
  elapsedSeconds: number;
  production: Record<ProductionSlot, UnitDefinition | null>;
  specialCooldown: number;
}

interface HudCallbacks {
  onSpawn: (slot: ProductionSlot) => void;
  onOpenPromotion: (mode: PromotionMode) => void;
  onPromotion: (id: string) => void;
  onClosePromotion: () => void;
  onCamera: (direction: 'left' | 'right' | 'in' | 'out') => void;
}

export class GameHud {
  private readonly root: HTMLDivElement;
  private readonly gold: HTMLElement;
  private readonly baseStatus: HTMLElement;
  private readonly time: HTMLElement;
  private readonly toast: HTMLElement;
  private readonly productionButtons = new Map<ProductionSlot, HTMLButtonElement>();
  private readonly modal: HTMLDivElement;
  private readonly modalTitle: HTMLElement;
  private readonly modalOptions: HTMLElement;
  private toastTimer = 0;

  constructor(private readonly callbacks: HudCallbacks) {
    this.root = document.createElement('div');
    this.root.className = 'game-hud';
    this.root.innerHTML = `
      <header class="hud-top">
        <div class="hud-brand">AGE OF LINUX2</div>
        <div class="hud-resource" data-ref="gold">🪙 10G</div>
        <div class="hud-base-status" data-ref="bases"></div>
        <div class="hud-time" data-ref="time">00:00</div>
      </header>
      <div class="hud-toast" data-ref="toast" aria-live="polite"></div>
      <aside class="camera-controls" aria-label="카메라 조작">
        <button data-camera="left" title="왼쪽 이동">◀</button><button data-camera="right" title="오른쪽 이동">▶</button>
        <button data-camera="in" title="확대">＋</button><button data-camera="out" title="축소">−</button>
      </aside>
      <footer class="hud-bottom">
        <div class="production-panel" data-ref="production"></div>
        <div class="promotion-buttons">
          <button class="hud-action" data-promotion-mode="normal">전직 <kbd>5</kbd></button>
          <button class="hud-action special" data-promotion-mode="special">스페셜 <kbd>6</kbd></button>
        </div>
      </footer>
      <div class="promotion-modal" data-ref="modal" aria-hidden="true">
        <div class="promotion-card">
          <button class="modal-close" data-ref="close" aria-label="닫기">×</button>
          <h2 data-ref="modal-title">전직</h2>
          <p class="modal-help">전직은 현재 생산 병종을 영구 교체합니다.</p>
          <div class="promotion-options" data-ref="modal-options"></div>
        </div>
      </div>`;
    document.body.appendChild(this.root);
    this.gold = this.get('[data-ref="gold"]');
    this.baseStatus = this.get('[data-ref="bases"]');
    this.time = this.get('[data-ref="time"]');
    this.toast = this.get('[data-ref="toast"]');
    this.modal = this.get<HTMLDivElement>('[data-ref="modal"]');
    this.modalTitle = this.get('[data-ref="modal-title"]');
    this.modalOptions = this.get('[data-ref="modal-options"]');

    const panel = this.get('[data-ref="production"]');
    (['infantry', 'archer', 'cavalry', 'special'] as ProductionSlot[]).forEach((slot, index) => {
      const button = document.createElement('button');
      button.className = 'unit-button';
      button.dataset.slot = slot;
      button.addEventListener('click', () => this.callbacks.onSpawn(slot));
      button.innerHTML = `<span class="unit-key">${index + 1}</span><span class="unit-name">-</span><span class="unit-cost">-</span>`;
      panel.appendChild(button);
      this.productionButtons.set(slot, button);
    });
    this.root.querySelectorAll<HTMLElement>('[data-promotion-mode]').forEach((button) => button.addEventListener('click', () => this.callbacks.onOpenPromotion(button.dataset.promotionMode as PromotionMode)));
    this.root.querySelectorAll<HTMLElement>('[data-camera]').forEach((button) => button.addEventListener('click', () => this.callbacks.onCamera(button.dataset.camera as 'left' | 'right' | 'in' | 'out')));
    this.get('[data-ref="close"]').addEventListener('click', () => this.callbacks.onClosePromotion());
    this.modal.addEventListener('pointerdown', (event) => { if (event.target === this.modal) this.callbacks.onClosePromotion(); });
  }

  update(state: HudState): void {
    this.gold.textContent = `🪙 ${Math.floor(state.gold)}G`;
    this.baseStatus.innerHTML = `<span class="ally">아군 ${Math.ceil(state.playerBaseHp)}/${state.playerBaseMaxHp}</span><span class="versus">VS</span><span class="enemy">적군 ${Math.ceil(state.enemyBaseHp)}/${state.enemyBaseMaxHp}</span>`;
    const minutes = Math.floor(state.elapsedSeconds / 60).toString().padStart(2, '0');
    const seconds = Math.floor(state.elapsedSeconds % 60).toString().padStart(2, '0');
    this.time.textContent = `${minutes}:${seconds}`;
    (Object.entries(state.production) as [ProductionSlot, UnitDefinition | null][]).forEach(([slot, definition]) => {
      const button = this.productionButtons.get(slot)!;
      const name = button.querySelector('.unit-name')!;
      const cost = button.querySelector('.unit-cost')!;
      if (!definition) {
        name.textContent = slot === 'special' ? '스페셜 미해금' : '-';
        cost.textContent = slot === 'special' ? '전직 필요' : '';
        button.disabled = true;
      } else {
        name.textContent = definition.name;
        const cooldown = slot === 'special' && state.specialCooldown > 0 ? ` · ${Math.ceil(state.specialCooldown)}초` : '';
        cost.textContent = `${definition.cost}G${cooldown}`;
        button.disabled = state.gold < definition.cost || (slot === 'special' && state.specialCooldown > 0);
      }
    });
  }

  openPromotion(mode: PromotionMode, options: PromotionOption[]): void {
    this.modalTitle.textContent = mode === 'normal' ? '일반 병종 전직' : '스페셜 전직';
    this.modalOptions.innerHTML = '';
    if (options.length === 0) {
      this.modalOptions.innerHTML = '<p class="empty-options">현재 가능한 전직이 없습니다.</p>';
    }
    options.forEach((option) => {
      const button = document.createElement('button');
      button.className = 'promotion-option';
      button.disabled = option.disabled;
      button.innerHTML = `<kbd>${option.hotkey}</kbd><strong>${option.label}</strong><span>${option.description}</span><em>${option.cost}G</em>`;
      button.addEventListener('click', () => this.callbacks.onPromotion(option.id));
      this.modalOptions.appendChild(button);
    });
    this.modal.classList.add('visible');
    this.modal.setAttribute('aria-hidden', 'false');
  }

  closePromotion(): void {
    this.modal.classList.remove('visible');
    this.modal.setAttribute('aria-hidden', 'true');
  }

  message(text: string): void {
    window.clearTimeout(this.toastTimer);
    this.toast.textContent = text;
    this.toast.classList.add('visible');
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove('visible'), 2200);
  }

  destroy(): void {
    window.clearTimeout(this.toastTimer);
    this.root.remove();
  }

  private get<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`HUD 요소를 찾을 수 없습니다: ${selector}`);
    return element;
  }
}
