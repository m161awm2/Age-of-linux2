import Phaser from 'phaser';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  DIFFICULTIES, ENEMY_BASE_X, GROUND_TEXTURE_HEIGHT, GROUND_TEXTURE_SURFACE_Y, GROUND_Y,
  HILLS_TEXTURE_BOTTOM_Y, PLAYER_BASE_X, PROMOTION_COSTS, PROMOTION_OPTIONS, SECOND_PROMOTIONS,
  SPECIAL_ELITE, WORLD_HEIGHT, WORLD_WIDTH,
} from '../data/constants';
import { UNITS } from '../data/units';
import type { Difficulty, GameLaunchData, Team, UnitKind } from '../data/types';
import { BaseEntity } from '../entities/BaseEntity';
import { CombatUnit } from '../entities/CombatUnit';
import { AudioService } from '../services/AudioService';
import { GameProgressService } from '../services/GameProgressService';
import { RankService } from '../services/RankService';
import { PvpRoomService, type PvpBattleSnapshot } from '../services/PvpRoomService';
import { AISystem } from '../systems/AISystem';
import { CombatSystem } from '../systems/CombatSystem';
import { EconomySystem } from '../systems/EconomySystem';
import { MovementSystem } from '../systems/MovementSystem';
import { GameHud, type HudState, type ProductionSlot, type PromotionMode, type PromotionOption } from '../ui/GameHud';
import { SettingsPanel } from '../ui/SettingsPanel';
import { PlayerProgressService, type SpecialPath } from '../services/PlayerProgressService';

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
  private pinchDistance = 0;
  private pvp: GameLaunchData['pvp'];
  private localTeam: Team = 'player';
  private pvpPollTimer: number | null = null;
  private pvpStateTimer: number | null = null;
  private pvpFallbackStateTimer: number | null = null;
  private pvpRealtimeChannel: RealtimeChannel | null = null;
  private pvpPolling = false;
  private pvpStateBusy = false;
  private pvpStateSequence = 0;
  private lastPvpEventId = 0;
  private readonly appliedPvpEvents = new Set<number>();
  private readonly pvpUnits = new Map<number, CombatUnit>();
  private pvpEmergencySupplyClaimed = false;

  constructor() { super('GameScene'); }

  init(data: GameLaunchData): void {
    this.difficulty = data.difficulty ?? 'Hard';
    this.pvp = data.pvp;
    this.localTeam = this.pvp?.isHost === false ? 'enemy' : 'player';
    this.progress = new GameProgressService(PlayerProgressService.current.unlockedSpecialPaths);
    this.economy = new EconomySystem();
    this.movement = new MovementSystem();
    this.playerUnits = [];
    this.enemyUnits = [];
    this.finished = false;
    this.rankedRunPromise = Promise.resolve(null);
    this.promotionMode = null;
    this.promotionOptions = [];
    this.specialReadyAt = 0;
    this.lastPromotionGold = -1;
    this.pinchDistance = 0;
    this.pvpPolling = false;
    this.pvpStateBusy = false;
    this.pvpStateSequence = 0;
    this.lastPvpEventId = 0;
    this.appliedPvpEvents.clear();
    this.pvpUnits.clear();
    this.pvpEmergencySupplyClaimed = false;
  }

  create(): void {
    const difficultyConfig = DIFFICULTIES[this.difficulty];
    if (!this.pvp && this.difficulty === 'Impossible') AudioService.playHellTheme(this);
    else AudioService.prepare(this);
    this.startedAt = this.time.now;
    this.lastEnemySupplyHp = this.pvp ? 100 : difficultyConfig.enemyBaseHp;
    this.ai = new AISystem(this.difficulty);
    this.combat = new CombatSystem(this);
    this.createBattlefield();
    this.playerBase = new BaseEntity(
      this, 'player', PLAYER_BASE_X, GROUND_Y + 2, 100, 'player',
      this.pvp && this.localTeam === 'enemy' ? 'enemy' : 'player',
    );
    this.enemyBase = new BaseEntity(
      this, 'enemy', ENEMY_BASE_X, GROUND_Y + 2, this.pvp ? 100 : difficultyConfig.enemyBaseHp,
      this.pvp ? 'player' : 'enemy', this.pvp && this.localTeam === 'enemy' ? 'player' : 'enemy',
    );
    this.createCamera();
    this.createHud();
    this.createInputs();
    this.events.on('battle-message', this.onBattleMessage, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    if (this.pvp) {
      this.hud.message(`${this.pvp.isHost ? '왼쪽' : '오른쪽'} 진영 · ${this.pvp.opponentLoginId}님과의 전투가 시작되었습니다.`);
      this.pvpRealtimeChannel = PvpRoomService.subscribeToBattleState(
        this.pvp.roomId,
        (snapshot) => {
          if (!this.pvp?.isHost) this.applyPvpSnapshot(snapshot);
        },
      );
      void this.pollPvpEvents();
      this.pvpPollTimer = window.setInterval(() => void this.pollPvpEvents(), 350);
      if (this.pvp.isHost) {
        this.pvpStateTimer = window.setInterval(() => this.broadcastPvpState(), 100);
        this.pvpFallbackStateTimer = window.setInterval(() => void this.publishPvpState(), 1000);
      } else {
        void this.pullPvpState();
        this.pvpFallbackStateTimer = window.setInterval(() => void this.pullPvpState(), 1000);
      }
    } else {
      this.hud.message(`${difficultyConfig.label} 난이도 전투가 시작되었습니다.`);
      this.rankedRunPromise = RankService.startRun(this.difficulty);
    }
  }

  update(_time: number, delta: number): void {
    if (this.finished) return;
    const dt = Math.min(delta / 1000, .05);
    const now = this.time.now;
    const elapsed = (now - this.startedAt) / 1000;
    if (this.pvp && !this.pvp.isHost) {
      this.playerUnits.forEach((unit) => unit.updateNetworkPosition(dt));
      this.enemyUnits.forEach((unit) => unit.updateNetworkPosition(dt));
    }
    this.economy.update(dt);
    if (!this.pvp) this.ai.update(dt, elapsed, (kind) => this.spawnUnit(kind, 'enemy'));
    this.updateCamera(dt);

    if (!this.pvp || this.pvp.isHost) {
      this.movement.update(this.playerUnits, this.enemyUnits, dt, now);
      this.movement.update(this.enemyUnits, this.playerUnits, dt, now);
      this.combat.update(this.playerUnits, this.enemyUnits, this.enemyBase, now);
      this.combat.update(this.enemyUnits, this.playerUnits, this.playerBase, now);
      this.payBountiesAndRemoveDead();
    }
    // 이동과 전투 계산 뒤에 시각 효과를 갱신해 별도 레이어의 화염이
    // 화염방사병의 현재 위치를 정확히 따라가게 한다.
    this.playerUnits.forEach((unit) => unit.updateStatus(now));
    this.enemyUnits.forEach((unit) => unit.updateStatus(now));
    if (!this.pvp) this.applyEnemyBaseSupply();
    else this.applyPvpEmergencySupply();
    this.updateHud(elapsed);

    if (this.enemyBase.hp <= 0) this.finish(this.localTeam === 'player', elapsed);
    else if (this.playerBase.hp <= 0) this.finish(this.localTeam === 'enemy', elapsed);
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
    const cameraCenter = this.localTeam === 'enemy' ? ENEMY_BASE_X - 440 : 620;
    camera.scrollX = Math.max(0, cameraCenter - camera.width / (2 * camera.zoom));
    this.alignCameraToGround();
    camera.setRoundPixels(true);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.alignCameraToGround, this);
    this.input.addPointer(1);
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objects: unknown[], _dx: number, dy: number) => this.zoomCamera(dy < 0 ? .08 : -.08));
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const first = this.input.pointer1;
      const second = this.input.pointer2;
      if (first.isDown && second.isDown) {
        const distance = Phaser.Math.Distance.Between(first.x, first.y, second.x, second.y);
        if (this.pinchDistance > 0) this.zoomCamera((distance - this.pinchDistance) / 280);
        this.pinchDistance = distance;
        return;
      }
      this.pinchDistance = 0;
      if (!pointer.isDown) return;
      camera.scrollX -= (pointer.x - pointer.prevPosition.x) / camera.zoom;
    });
    this.input.on('pointerup', () => { this.pinchDistance = 0; });
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

  private async spawnFromSlot(slot: ProductionSlot): Promise<void> {
    const kind = slot === 'special' ? this.progress.special : this.progress[slot];
    if (!kind) { this.hud.message('먼저 스페셜 계열을 해금하세요.'); return; }
    const definition = UNITS[kind];
    if (definition.eliteCooldown && this.time.now < this.specialReadyAt) {
      this.hud.message(`엘리트 재정비까지 ${Math.ceil((this.specialReadyAt - this.time.now) / 1000)}초 남았습니다.`);
      return;
    }
    if (!this.economy.spend(definition.cost)) { this.hud.message(`${definition.name} 생산에 ${definition.cost}G가 필요합니다.`); return; }
    if (this.pvp) {
      try {
        const event = await PvpRoomService.sendSpawn(this.pvp.roomId, kind);
        if (this.finished || !this.scene.isActive()) return;
        this.applyPvpSpawnEvent(event);
      } catch (error) {
        this.economy.reward(definition.cost);
        this.hud.message(this.getNetworkError(error));
        return;
      }
    } else {
      this.spawnUnit(kind, 'player');
    }
    if (definition.eliteCooldown) this.specialReadyAt = this.time.now + definition.eliteCooldown * 1000;
    this.hud.message(`${definition.name}을(를) 소환했습니다.`);
  }

  private spawnUnit(kind: UnitKind, team: 'player' | 'enemy'): CombatUnit {
    const x = team === 'player' ? PLAYER_BASE_X + 185 : ENEMY_BASE_X - 185;
    const displayTeam: Team = this.pvp ? (team === this.localTeam ? 'player' : 'enemy') : team;
    const unit = new CombatUnit(this, UNITS[kind], team, x, GROUND_Y + 2, displayTeam);
    (team === 'player' ? this.playerUnits : this.enemyUnits).push(unit);
    return unit;
  }

  private async pollPvpEvents(): Promise<void> {
    if (!this.pvp || this.pvpPolling || this.finished) return;
    this.pvpPolling = true;
    try {
      const events = await PvpRoomService.getSpawnEvents(this.pvp.roomId, this.lastPvpEventId);
      events.forEach((event) => {
        this.lastPvpEventId = Math.max(this.lastPvpEventId, event.id);
        this.applyPvpSpawnEvent(event);
      });
    } catch (error) {
      this.hud?.message(this.getNetworkError(error));
    } finally {
      this.pvpPolling = false;
    }
  }

  private applyPvpSpawnEvent(event: Awaited<ReturnType<typeof PvpRoomService.sendSpawn>>): void {
    if (!this.pvp || this.appliedPvpEvents.has(event.id)) return;
    if (event.user_id !== this.pvp.hostUserId && event.user_id !== this.pvp.guestUserId) return;
    if (!(event.unit_kind in UNITS)) return;
    this.appliedPvpEvents.add(event.id);
    const team: Team = event.user_id === this.pvp.hostUserId ? 'player' : 'enemy';
    // 서버 생성 시각 + 1초에 양쪽이 함께 생성해 폴링 왕복 시간 차이를 흡수한다.
    const scheduledAt = new Date(event.created_at).getTime() + 1000;
    const delay = Number.isFinite(scheduledAt) ? Math.max(0, scheduledAt - Date.now()) : 0;
    this.time.delayedCall(delay, () => {
      if (!this.finished && this.scene.isActive()) {
        const unit = this.spawnUnit(event.unit_kind, team);
        this.pvpUnits.set(event.id, unit);
      }
    });
  }

  private async publishPvpState(force = false): Promise<void> {
    if (!this.pvp?.isHost || (this.pvpStateBusy && !force) || (this.finished && !force)) return;
    if (!force) this.pvpStateBusy = true;
    const snapshot = this.createPvpSnapshot();
    try {
      await PvpRoomService.setBattleState(this.pvp.roomId, snapshot);
    } catch (error) {
      console.warn('1대1 전투 상태 전송 실패', error);
    } finally {
      if (!force) this.pvpStateBusy = false;
    }
  }

  private broadcastPvpState(): void {
    if (!this.pvp?.isHost || !this.pvpRealtimeChannel || this.finished) return;
    PvpRoomService.broadcastBattleState(this.pvpRealtimeChannel, this.createPvpSnapshot());
  }

  private createPvpSnapshot(): PvpBattleSnapshot {
    return {
      sequence: ++this.pvpStateSequence,
      player_base_hp: this.playerBase.hp,
      enemy_base_hp: this.enemyBase.hp,
      units: [...this.pvpUnits.entries()].map(([eventId, unit]) => ({
        event_id: eventId, x: unit.x, hp: unit.hp, burn_stacks: unit.burnStackCount,
      })),
    };
  }

  private async pullPvpState(): Promise<void> {
    if (!this.pvp || this.pvp.isHost || this.pvpStateBusy || this.finished) return;
    this.pvpStateBusy = true;
    try {
      const snapshot = await PvpRoomService.getBattleState(this.pvp.roomId);
      if (!snapshot) return;
      this.applyPvpSnapshot(snapshot);
    } catch (error) {
      console.warn('1대1 전투 상태 수신 실패', error);
    } finally {
      this.pvpStateBusy = false;
    }
  }

  private applyPvpSnapshot(snapshot: PvpBattleSnapshot): void {
    if (snapshot.sequence <= this.pvpStateSequence || this.finished) return;
    this.pvpStateSequence = snapshot.sequence;
    this.playerBase.applyNetworkHp(snapshot.player_base_hp);
    this.enemyBase.applyNetworkHp(snapshot.enemy_base_hp);
    snapshot.units.forEach((state) => {
        const unit = this.pvpUnits.get(state.event_id);
        if (!unit || !unit.active) return;
        const wasAlive = unit.alive;
        unit.applyNetworkState(state.x, state.hp, state.burn_stacks);
        if (wasAlive && !unit.alive && unit.team !== this.localTeam) {
          this.economy.reward(Math.max(1, Math.floor(unit.definition.cost * .5)));
        }
        if (!unit.alive) {
          unit.destroy();
          this.pvpUnits.delete(state.event_id);
          this.playerUnits = this.playerUnits.filter((item) => item !== unit);
          this.enemyUnits = this.enemyUnits.filter((item) => item !== unit);
        }
      });
  }

  private getNetworkError(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error) return String(error.message);
    return '전투 동기화에 실패했습니다.';
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
      const secondInfantry = SECOND_PROMOTIONS[this.progress.infantry];
      const secondArcher = SECOND_PROMOTIONS[this.progress.archer];
      if (secondInfantry) { kinds = [secondInfantry]; cost = PROMOTION_COSTS.secondInfantry; }
      else if (secondArcher) { kinds = [secondArcher]; cost = PROMOTION_COSTS.secondArcher; }
    }
    return kinds.map((kind, index) => ({
      id: `normal:${kind}`, hotkey: `${index + 6}`, label: UNITS[kind].name, cost,
      description: UNITS[kind].description, disabled: this.economy.gold < cost,
    }));
  }

  private getSpecialPromotions(): PromotionOption[] {
    if (!this.progress.specialPath) {
      const paths: SpecialPath[] = ['ronin', 'fenrir', 'hatchling'];
      return paths.map((path, index) => {
        const unlocked = this.progress.unlockedSpecialPaths.includes(path);
        return {
        id: `special:${path}`,
        hotkey: `${index + 7}`,
        label: UNITS[path].name,
        cost: PROMOTION_COSTS.special,
        costLabel: unlocked ? `${PROMOTION_COSTS.special}G` : '상점 해금 필요',
        description: unlocked ? UNITS[path].description : '상점에서 이 스페셜 계열을 먼저 해금하세요.',
        disabled: !unlocked || this.economy.gold < PROMOTION_COSTS.special,
        };
      });
    }
    if (this.progress.specialPath && this.progress.special === this.progress.specialPath) {
      const elite = SPECIAL_ELITE[this.progress.specialPath];
      return [{
        id: `elite:${elite}`,
        hotkey: '7',
        label: UNITS[elite].name,
        cost: PROMOTION_COSTS.specialElite,
        description: UNITS[elite].description,
        disabled: this.economy.gold < PROMOTION_COSTS.specialElite,
      }];
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
      else if (Object.values(SECOND_PROMOTIONS).includes(rawKind)) {
        const archerSecond = SECOND_PROMOTIONS[this.progress.archer] === rawKind;
        cost = archerSecond ? PROMOTION_COSTS.secondArcher : PROMOTION_COSTS.secondInfantry;
      }
      if (!this.economy.spend(cost)) return;
      if (PROMOTION_OPTIONS.infantry.includes(rawKind)) this.progress.setFirstPromotion('infantry', rawKind);
      else if (PROMOTION_OPTIONS.archer.includes(rawKind)) this.progress.setFirstPromotion('archer', rawKind);
      else if (PROMOTION_OPTIONS.cavalry.includes(rawKind)) this.progress.setFirstPromotion('cavalry', rawKind);
      else if (SECOND_PROMOTIONS[this.progress.infantry] === rawKind) this.progress.applySecondPromotion('infantry');
      else if (SECOND_PROMOTIONS[this.progress.archer] === rawKind) this.progress.applySecondPromotion('archer');
    } else if (type === 'special') {
      if (!this.economy.spend(PROMOTION_COSTS.special)) return;
      const selected = this.progress.selectSpecial(rawKind as SpecialPath);
      if (!selected) {
        this.economy.reward(PROMOTION_COSTS.special);
        return;
      }
      this.hud.message(`${UNITS[selected].name} 계열을 선택했습니다.`);
      this.closePromotion();
      return;
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
        if (this.pvp) {
          if (this.localTeam === 'enemy') this.economy.reward(Math.max(1, Math.floor(unit.definition.cost * .5)));
        } else {
          this.ai.economy.reward(Math.max(1, Math.floor(unit.definition.cost * aiRate)));
        }
        this.time.delayedCall(450, () => unit.destroy());
      }
    });
    this.enemyUnits.forEach((unit) => {
      if (!unit.alive && !unit.bountyPaid) {
        unit.bountyPaid = true;
        if (!this.pvp || this.localTeam === 'player') this.economy.reward(Math.max(1, Math.floor(unit.definition.cost * .5)));
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

  private applyPvpEmergencySupply(): void {
    if (!this.pvp || this.pvpEmergencySupplyClaimed) return;
    const localBase = this.localTeam === 'player' ? this.playerBase : this.enemyBase;
    if (localBase.hp <= 0 || localBase.hp > localBase.maxHp * .5) return;
    this.pvpEmergencySupplyClaimed = true;
    this.economy.reward(30);
    this.hud.message('성 체력이 50% 이하로 떨어져 긴급 보급 30G를 받았습니다!');
  }

  private updateHud(elapsedSeconds: number): void {
    const special = this.progress.special ? UNITS[this.progress.special] : null;
    const allyBase = this.localTeam === 'player' ? this.playerBase : this.enemyBase;
    const opponentBase = this.localTeam === 'player' ? this.enemyBase : this.playerBase;
    const state: HudState = {
      gold: this.economy.gold,
      playerBaseHp: allyBase.hp, playerBaseMaxHp: allyBase.maxHp,
      enemyBaseHp: opponentBase.hp, enemyBaseMaxHp: opponentBase.maxHp,
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
    const minimumGround = this.scale.height < 450 ? Math.max(210, this.scale.height - 62) : 320;
    return Math.max(minimumGround, this.scale.height - bottomClearance);
  }

  private alignCameraToGround(): void {
    const camera = this.cameras.main;
    camera.scrollY = GROUND_Y - this.groundScreenY() / camera.zoom;
  }

  private finish(victory: boolean, elapsedSeconds: number): void {
    if (this.finished) return;
    if (this.pvp?.isHost) {
      this.broadcastPvpState();
      void this.publishPvpState(true);
    }
    this.finished = true;
    this.closePromotion();
    if (this.pvpPollTimer !== null) window.clearInterval(this.pvpPollTimer);
    this.pvpPollTimer = null;
    if (this.pvpStateTimer !== null) window.clearInterval(this.pvpStateTimer);
    this.pvpStateTimer = null;
    if (this.pvpFallbackStateTimer !== null) window.clearInterval(this.pvpFallbackStateTimer);
    this.pvpFallbackStateTimer = null;
    this.time.delayedCall(700, () => {
      if (this.pvp) {
        this.scene.start('ResultScene', {
          victory, elapsedSeconds, difficulty: this.difficulty, isPvp: true,
          unitLoadout: [this.progress.infantry, this.progress.archer, this.progress.cavalry, ...(this.progress.special ? [this.progress.special] : [])],
        });
        return;
      }
      const rankedRun = Promise.race([
        this.rankedRunPromise,
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 1200)),
      ]);
      void rankedRun.then((rankedRunId) => this.scene.start('ResultScene', {
        victory, elapsedSeconds, difficulty: this.difficulty, rankedRunId: rankedRunId ?? undefined,
        unitLoadout: [
          this.progress.infantry,
          this.progress.archer,
          this.progress.cavalry,
          ...(this.progress.special ? [this.progress.special] : []),
        ],
      }));
    });
  }

  private onBattleMessage(message: string): void { this.hud.message(message); }

  private shutdown(): void {
    if (!this.pvp && this.difficulty === 'Impossible') AudioService.prepare(this);
    if (this.pvpPollTimer !== null) window.clearInterval(this.pvpPollTimer);
    this.pvpPollTimer = null;
    if (this.pvpStateTimer !== null) window.clearInterval(this.pvpStateTimer);
    this.pvpStateTimer = null;
    if (this.pvpFallbackStateTimer !== null) window.clearInterval(this.pvpFallbackStateTimer);
    this.pvpFallbackStateTimer = null;
    if (this.pvpRealtimeChannel) PvpRoomService.closeBattleChannel(this.pvpRealtimeChannel);
    this.pvpRealtimeChannel = null;
    this.events.off('battle-message', this.onBattleMessage, this);
    this.combat?.destroy();
    this.hud?.destroy();
    this.settingsPanel?.destroy();
    this.scale.off(Phaser.Scale.Events.RESIZE, this.alignCameraToGround, this);
  }
}
