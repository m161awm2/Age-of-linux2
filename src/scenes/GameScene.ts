import Phaser from 'phaser';
import {
  DIFFICULTIES, ENEMY_BASE_X, GROUND_TEXTURE_HEIGHT, GROUND_TEXTURE_SURFACE_Y, GROUND_Y,
  HILLS_TEXTURE_BOTTOM_Y, PLAYER_BASE_X, PROMOTION_COSTS, PROMOTION_OPTIONS, SECOND_PROMOTIONS,
  SPECIAL_ELITE, SPECIAL_UNLOCK_COST, WORLD_HEIGHT, WORLD_WIDTH,
} from '../data/constants';
import { UNITS } from '../data/units';
import type { Difficulty, GameLaunchData, UnitKind } from '../data/types';
import { BaseEntity } from '../entities/BaseEntity';
import { CombatUnit } from '../entities/CombatUnit';
import { GameProgressService } from '../services/GameProgressService';
import { RankService } from '../services/RankService';
import { AISystem } from '../systems/AISystem';
import { CombatSystem } from '../systems/CombatSystem';
import { EconomySystem } from '../systems/EconomySystem';
import { MovementSystem } from '../systems/MovementSystem';
import { GameHud, type HudState, type ProductionSlot, type PromotionMode, type PromotionOption } from '../ui/GameHud';
import { SettingsPanel } from '../ui/SettingsPanel';

export class GameScene extends Phaser.Scene {
  private difficulty: Difficulty = 'Hard';
  private progress!: GameProgressService;
  private economy!: EconomySystem;
  private ai!: AISystem;
  private combat!: CombatSystem;
  private movement!: MovementSystem;
  private playerBase!: BaseEntity;
  private enemyBase!: BaseEntity;
  private playerUnits: CombatUnit[] = [];
  private enemyUnits: CombatUnit[] = [];
  private unitComposition: Partial<Record<UnitKind, number>> = {};
  private hud!: GameHud;
  private settingsPanel!: SettingsPanel;
  private startedAt = 0;
  private finished = false;
  private rankedRunPromise: Promise<string | null> = Promise.resolve(null);
  private lastEnemySupplyHp = 0;
  private promotionMode: PromotionMode | null = null;
  private promotionOptions: PromotionOption[] = [];
  private specialReadyAt = 0;
  private lastPromotionGold = -1;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private cameraKeys?: Record<'left' | 'right' | 'zoomIn' | 'zoomOut', Phaser.Input.Keyboard.Key>;

  constructor() { super('GameScene'); }

  init(data: GameLaunchData): void {
    this.difficulty = data.difficulty ?? 'Hard';
    this.progress = new GameProgressService();
    this.economy = new EconomySystem();
    this.movement = new MovementSystem();
    this.playerUnits = [];
    this.enemyUnits = [];
    this.unitComposition = {};
    this.finished = false;
    this.rankedRunPromise = Promise.resolve(null);
    this.promotionMode = null;
    this.promotionOptions = [];
    this.specialReadyAt = 0;
    this.lastPromotionGold = -1;
  }

  create(): void {
    const difficultyConfig = DIFFICULTIES[this.difficulty];
    this.startedAt = this.time.now;
    this.lastEnemySupplyHp = difficultyConfig.enemyBaseHp;
    this.ai = new AISystem(this.difficulty);
    this.combat = new CombatSystem(this);
    this.createBattlefield();
    this.playerBase = new BaseEntity(this, 'player', PLAYER_BASE_X, GROUND_Y + 2, 100);
    this.enemyBase = new BaseEntity(this, 'enemy', ENEMY_BASE_X, GROUND_Y + 2, difficultyConfig.enemyBaseHp);
    this.createCamera();
    this.createHud();
    this.createInputs();
    this.events.on('battle-message', this.onBattleMessage, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.hud.message(`${difficultyConfig.label} 난이도 전투가 시작되었습니다.`);
    this.rankedRunPromise = RankService.startRun(this.difficulty);
  }

  update(_time: number, delta: number): void {
    if (this.finished) return;
    const dt = Math.min(delta / 1000, .05);
    const now = this.time.now;
    const elapsed = (now - this.startedAt) / 1000;
    this.playerUnits.forEach((unit) => unit.updateStatus(now));
    this.enemyUnits.forEach((unit) => unit.updateStatus(now));
    this.economy.update(dt);
    this.ai.update(dt, elapsed, (kind) => this.spawnUnit(kind, 'enemy'));
    this.updateCamera(dt);

    this.movement.update(this.playerUnits, this.enemyUnits, dt, now);
    this.movement.update(this.enemyUnits, this.playerUnits, dt, now);
    this.combat.update(this.playerUnits, this.enemyUnits, this.enemyBase, now);
    this.combat.update(this.enemyUnits, this.playerUnits, this.playerBase, now);
    this.payBountiesAndRemoveDead();
    this.applyEnemyBaseSupply();
    this.updateHud(elapsed);

    if (this.enemyBase.hp <= 0) this.finish(true, elapsed);
    else if (this.playerBase.hp <= 0) this.finish(false, elapsed);
  }

  private createBattlefield(): void {
    this.cameras.main.setBackgroundColor('#71b9ee');
    this.add.tileSprite(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT, 'sky').setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT).setDepth(0);
    const hillsY = GROUND_Y - HILLS_TEXTURE_BOTTOM_Y + GROUND_TEXTURE_HEIGHT / 2;
    const groundY = GROUND_Y - GROUND_TEXTURE_SURFACE_Y + GROUND_TEXTURE_HEIGHT / 2;
    this.add.tileSprite(WORLD_WIDTH / 2, hillsY, WORLD_WIDTH, GROUND_TEXTURE_HEIGHT, 'hills').setDepth(1);
    this.add.rectangle(WORLD_WIDTH / 2, GROUND_Y + 180, WORLD_WIDTH, 400, 0x59432c).setDepth(3);
    this.add.tileSprite(WORLD_WIDTH / 2, groundY, WORLD_WIDTH, GROUND_TEXTURE_HEIGHT, 'ground').setDepth(4);
    const lane = this.add.rectangle(WORLD_WIDTH / 2, GROUND_Y + 8, WORLD_WIDTH, 3, 0xd1c17e, .24).setDepth(5);
    lane.setBlendMode(Phaser.BlendModes.ADD);
    for (let x = 620; x < WORLD_WIDTH - 600; x += 360) {
      this.add.text(x, GROUND_Y + 12, '•', { fontSize: '22px', color: '#6d5a36' }).setAlpha(.22).setDepth(6);
    }
  }

  private createCamera(): void {
    const camera = this.cameras.main;
    camera.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    camera.setZoom(.9);
    camera.scrollX = Math.max(0, 620 - camera.width / (2 * camera.zoom));
    this.alignCameraToGround();
    camera.setRoundPixels(true);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.alignCameraToGround, this);
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objects: unknown[], _dx: number, dy: number) => this.zoomCamera(dy < 0 ? .08 : -.08));
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) return;
      camera.scrollX -= (pointer.x - pointer.prevPosition.x) / camera.zoom;
    });
  }

  private createHud(): void {
    this.settingsPanel = new SettingsPanel();
    this.hud = new GameHud({
      onSpawn: (slot) => this.spawnFromSlot(slot),
      onOpenPromotion: (mode) => this.openPromotion(mode),
      onPromotion: (id) => this.applyPromotion(id),
      onClosePromotion: () => this.closePromotion(),
      onCamera: (direction) => this.cameraAction(direction),
      onOpenSettings: () => this.settingsPanel.open(),
    });
    this.updateHud(0);
  }

  private createInputs(): void {
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.cameraKeys = this.input.keyboard?.addKeys({ left: 'A', right: 'D', zoomIn: 'Q', zoomOut: 'E' }) as Record<'left' | 'right' | 'zoomIn' | 'zoomOut', Phaser.Input.Keyboard.Key>;
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key === 'Escape') { this.closePromotion(); return; }
      if (this.promotionMode) {
        const option = this.promotionOptions.find((item) => item.hotkey === event.key);
        if (option && !option.disabled) this.applyPromotion(option.id);
        else if ((this.promotionMode === 'normal' && event.key === '5') || (this.promotionMode === 'special' && event.key === '6')) this.closePromotion();
        return;
      }
      if (event.key >= '1' && event.key <= '4') {
        const slots: ProductionSlot[] = ['infantry', 'archer', 'cavalry', 'special'];
        const slot = slots[Number(event.key) - 1];
        if (slot) this.spawnFromSlot(slot);
      } else if (event.key === '5') this.openPromotion('normal');
      else if (event.key === '6') this.openPromotion('special');
    });
  }

  private spawnFromSlot(slot: ProductionSlot): void {
    const kind = slot === 'special' ? this.progress.special : this.progress[slot];
    if (!kind) { this.hud.message('먼저 스페셜 계열을 해금하세요.'); return; }
    const definition = UNITS[kind];
    if (definition.eliteCooldown && this.time.now < this.specialReadyAt) {
      this.hud.message(`엘리트 재정비까지 ${Math.ceil((this.specialReadyAt - this.time.now) / 1000)}초 남았습니다.`);
      return;
    }
    if (!this.economy.spend(definition.cost)) { this.hud.message(`${definition.name} 생산에 ${definition.cost}G가 필요합니다.`); return; }
    this.spawnUnit(kind, 'player');
    if (definition.eliteCooldown) this.specialReadyAt = this.time.now + definition.eliteCooldown * 1000;
  }

  private spawnUnit(kind: UnitKind, team: 'player' | 'enemy'): void {
    const x = team === 'player' ? PLAYER_BASE_X + 185 : ENEMY_BASE_X - 185;
    const unit = new CombatUnit(this, UNITS[kind], team, x, GROUND_Y + 2);
    (team === 'player' ? this.playerUnits : this.enemyUnits).push(unit);
    if (team === 'player') this.unitComposition[kind] = (this.unitComposition[kind] ?? 0) + 1;
  }

  private openPromotion(mode: PromotionMode): void {
    if (this.promotionMode === mode) { this.closePromotion(); return; }
    this.promotionMode = mode;
    this.promotionOptions = mode === 'normal' ? this.getNormalPromotions() : this.getSpecialPromotions();
    this.hud.openPromotion(mode, this.promotionOptions);
  }

  private closePromotion(): void {
    this.promotionMode = null;
    this.promotionOptions = [];
    this.hud?.closePromotion();
  }

  private getNormalPromotions(): PromotionOption[] {
    let kinds: UnitKind[] = [];
    let cost = 0;
    if (this.progress.infantry === 'soldier') { kinds = PROMOTION_OPTIONS.infantry; cost = PROMOTION_COSTS.infantry; }
    else if (this.progress.archer === 'archer') { kinds = PROMOTION_OPTIONS.archer; cost = PROMOTION_COSTS.archer; }
    else if (this.progress.cavalry === 'knight') { kinds = PROMOTION_OPTIONS.cavalry; cost = PROMOTION_COSTS.cavalry; }
    else {
      const second = SECOND_PROMOTIONS[this.progress.infantry];
      if (second) { kinds = [second]; cost = PROMOTION_COSTS.secondInfantry; }
    }
    return kinds.map((kind, index) => ({
      id: `normal:${kind}`, hotkey: `${index + 6}`, label: UNITS[kind].name, cost,
      description: UNITS[kind].description, disabled: this.economy.gold < cost,
    }));
  }

  private getSpecialPromotions(): PromotionOption[] {
    if (!this.progress.specialPath) {
      return (['ronin', 'fenrir'] as const).map((kind, index) => ({
        id: `special:${kind}`, hotkey: `${index + 5}`, label: `${UNITS[kind].name} 계열`, cost: SPECIAL_UNLOCK_COST[kind],
        description: kind === 'ronin' ? '발도술 → 사나다 사무라이' : '안티 레인지 → 바이킹 광전사',
        disabled: this.economy.gold < SPECIAL_UNLOCK_COST[kind],
      }));
    }
    if (this.progress.special === this.progress.specialPath) {
      const elite = SPECIAL_ELITE[this.progress.specialPath];
      return [{ id: `elite:${elite}`, hotkey: '7', label: UNITS[elite].name, cost: PROMOTION_COSTS.specialElite, description: UNITS[elite].description, disabled: this.economy.gold < PROMOTION_COSTS.specialElite }];
    }
    return [];
  }

  private applyPromotion(id: string): void {
    const [type, rawKind] = id.split(':') as [string, UnitKind];
    if (!rawKind) return;
    if (type === 'normal') {
      let cost = 0;
      if (PROMOTION_OPTIONS.infantry.includes(rawKind)) cost = PROMOTION_COSTS.infantry;
      else if (PROMOTION_OPTIONS.archer.includes(rawKind)) cost = PROMOTION_COSTS.archer;
      else if (PROMOTION_OPTIONS.cavalry.includes(rawKind)) cost = PROMOTION_COSTS.cavalry;
      else cost = PROMOTION_COSTS.secondInfantry;
      if (!this.economy.spend(cost)) return;
      if (PROMOTION_OPTIONS.infantry.includes(rawKind)) this.progress.setFirstPromotion('infantry', rawKind);
      else if (PROMOTION_OPTIONS.archer.includes(rawKind)) this.progress.setFirstPromotion('archer', rawKind);
      else if (PROMOTION_OPTIONS.cavalry.includes(rawKind)) this.progress.setFirstPromotion('cavalry', rawKind);
      else this.progress.applySecondInfantryPromotion();
    } else if (type === 'special' && (rawKind === 'ronin' || rawKind === 'fenrir')) {
      const cost = SPECIAL_UNLOCK_COST[rawKind];
      if (!this.economy.spend(cost)) return;
      this.progress.unlockSpecial(rawKind);
    } else if (type === 'elite') {
      if (!this.economy.spend(PROMOTION_COSTS.specialElite)) return;
      this.progress.promoteSpecial();
    }
    this.hud.message(`${UNITS[rawKind].name} 전직이 완료되었습니다!`);
    this.closePromotion();
  }

  private payBountiesAndRemoveDead(): void {
    const aiRate = DIFFICULTIES[this.difficulty].aiBountyRate;
    this.playerUnits.forEach((unit) => {
      if (!unit.alive && !unit.bountyPaid) {
        unit.bountyPaid = true;
        this.ai.economy.reward(Math.max(1, Math.floor(unit.definition.cost * aiRate)));
        this.time.delayedCall(450, () => unit.destroy());
      }
    });
    this.enemyUnits.forEach((unit) => {
      if (!unit.alive && !unit.bountyPaid) {
        unit.bountyPaid = true;
        this.economy.reward(Math.max(1, Math.floor(unit.definition.cost * .5)));
        this.time.delayedCall(450, () => unit.destroy());
      }
    });
    this.playerUnits = this.playerUnits.filter((unit) => unit.alive);
    this.enemyUnits = this.enemyUnits.filter((unit) => unit.alive);
  }

  private applyEnemyBaseSupply(): void {
    while (this.lastEnemySupplyHp - this.enemyBase.hp >= 50) {
      this.ai.economy.reward(20);
      this.lastEnemySupplyHp -= 50;
      this.hud.message('적군이 기지 피해 보급 20G를 받았습니다!');
    }
  }

  private updateHud(elapsedSeconds: number): void {
    const special = this.progress.special ? UNITS[this.progress.special] : null;
    const state: HudState = {
      gold: this.economy.gold,
      playerBaseHp: this.playerBase.hp, playerBaseMaxHp: this.playerBase.maxHp,
      enemyBaseHp: this.enemyBase.hp, enemyBaseMaxHp: this.enemyBase.maxHp,
      difficulty: this.difficulty, elapsedSeconds,
      production: { infantry: UNITS[this.progress.infantry], archer: UNITS[this.progress.archer], cavalry: UNITS[this.progress.cavalry], special },
      specialCooldown: Math.max(0, (this.specialReadyAt - this.time.now) / 1000),
    };
    this.hud.update(state);
    const roundedGold = Math.floor(this.economy.gold);
    if (this.promotionMode && roundedGold !== this.lastPromotionGold) {
      this.lastPromotionGold = roundedGold;
      this.promotionOptions = this.promotionMode === 'normal' ? this.getNormalPromotions() : this.getSpecialPromotions();
      this.hud.openPromotion(this.promotionMode, this.promotionOptions);
    }
  }

  private updateCamera(dt: number): void {
    if (!this.cursors || !this.cameraKeys) return;
    const direction = (this.cursors.left.isDown || this.cameraKeys.left.isDown ? -1 : 0) + (this.cursors.right.isDown || this.cameraKeys.right.isDown ? 1 : 0);
    this.cameras.main.scrollX += direction * 620 * dt / this.cameras.main.zoom;
    if (this.cameraKeys.zoomIn.isDown) this.zoomCamera(.55 * dt);
    if (this.cameraKeys.zoomOut.isDown) this.zoomCamera(-.55 * dt);
  }

  private cameraAction(direction: 'left' | 'right' | 'in' | 'out'): void {
    if (direction === 'left') this.cameras.main.scrollX -= 250 / this.cameras.main.zoom;
    else if (direction === 'right') this.cameras.main.scrollX += 250 / this.cameras.main.zoom;
    else this.zoomCamera(direction === 'in' ? .1 : -.1);
  }

  private zoomCamera(amount: number): void {
    const camera = this.cameras.main;
    const centerX = camera.scrollX + camera.width / (2 * camera.zoom);
    const minimumZoom = Math.max(.65, this.groundScreenY(.65) / GROUND_Y);
    camera.setZoom(Phaser.Math.Clamp(camera.zoom + amount, minimumZoom, 1.25));
    camera.scrollX = centerX - camera.width / (2 * camera.zoom);
    this.alignCameraToGround();
  }

  private groundScreenY(zoom = this.cameras.main.zoom): number {
    // 지면의 깨진 하단이 보이지 않도록 여백을 두고, 축소할수록 HUD 위로 더 들어 올린다.
    const zoomOutRatio = Phaser.Math.Clamp((1.25 - zoom) / .6, 0, 1);
    const bottomClearance = 136 + zoomOutRatio * 60;
    return Math.max(320, this.scale.height - bottomClearance);
  }

  private alignCameraToGround(): void {
    const camera = this.cameras.main;
    camera.scrollY = GROUND_Y - this.groundScreenY() / camera.zoom;
  }

  private finish(victory: boolean, elapsedSeconds: number): void {
    if (this.finished) return;
    this.finished = true;
    this.closePromotion();
    this.time.delayedCall(700, () => {
      const rankedRun = Promise.race([
        this.rankedRunPromise,
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 1200)),
      ]);
      void rankedRun.then((rankedRunId) => this.scene.start('ResultScene', {
        victory, elapsedSeconds, difficulty: this.difficulty, rankedRunId: rankedRunId ?? undefined,
        unitComposition: { ...this.unitComposition },
      }));
    });
  }

  private onBattleMessage(message: string): void { this.hud.message(message); }

  private shutdown(): void {
    this.events.off('battle-message', this.onBattleMessage, this);
    this.combat?.destroy();
    this.hud?.destroy();
    this.settingsPanel?.destroy();
    this.scale.off(Phaser.Scale.Events.RESIZE, this.alignCameraToGround, this);
  }
}
