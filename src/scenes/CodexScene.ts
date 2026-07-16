import Phaser from 'phaser';
import { UNIT_SHEET_BY_KEY } from '../assets/manifest';
import codexDescriptions from '../data/unit-codex.json';
import type { UnitFamily, UnitKind } from '../data/types';
import { UNIT_LIST } from '../data/units';

const FAMILY_LABELS: Record<UnitFamily, string> = {
  infantry: '보병',
  archer: '궁병',
  cavalry: '기병',
  special: '스페셜',
};

const TIER_LABELS = ['기본 병종', '1차 전직', '2차 전직'] as const;
const DESCRIPTION_PLACEHOLDER = 'unit-codex.json의 description 항목을 작성해 주세요.';

const ALTERNATE_STATES: Partial<Record<UnitKind, { label: string; texture: string }>> = {
  viking: { label: '광폭 모드', texture: 'vikingBerserk' },
  shieldGuard: { label: '롱소드 모드', texture: 'shieldGuardBroken' },
  dragoon: { label: '근접 모드', texture: 'dragoonMelee' },
  retiarius: { label: '근접 3연타', texture: 'retiariusMelee' },
};

type CodexStatKey = 'hp' | 'damage' | 'dps' | 'attackInterval' | 'range' | 'speed' | 'cost';

interface ConditionalStats {
  condition: string;
  effects: string[];
  overrides?: Partial<Record<CodexStatKey, string>>;
}

const CONDITIONAL_STATS: Partial<Record<UnitKind, ConditionalStats>> = {
  spearman: {
    condition: '기병 공격 시',
    effects: ['공격력 6→10 (×1.8)', '첫 돌격 1회 반격'],
    overrides: { damage: '6→10*' },
  },
  halberd: {
    condition: '항상 / 기병 공격 시',
    effects: ['대상 최대 HP의 20% 추가', '기병에게 기본 공격력 8→14 (×1.8)', '첫 돌격 1회 반격'],
    overrides: { damage: '8+HP 20%*' },
  },
  crusader: {
    condition: '공격 2회 적중마다',
    effects: ['체력 1 회복'],
  },
  shieldGuard: {
    condition: '방패 8 소진 후',
    effects: ['공격력 5→7', '롱소드 모드로 전환'],
    overrides: { damage: '5→7', dps: '5.00→7.00' },
  },
  fireArcher: {
    condition: '불화살 적중 후 1.5초',
    effects: ['0.5초마다 대상 최대 HP의 5% ×3', '불화살별 독립 중첩'],
  },
  gatlingGunner: {
    condition: '적이 사거리 안에 있는 동안',
    effects: ['제자리 고정', '0.9초 예열 후 0.28초마다 연사'],
  },
  retiarius: {
    condition: '첫 원거리 공격 / 근거리 전환',
    effects: ['삼지창 1회 투척', '이동속도 1.5배', '근거리 공격 1회당 3연타'],
    overrides: { damage: '8×3', dps: '26.67', range: '5→1.5칸', speed: '1.5배' },
  },
  siphonarioi: {
    condition: '전방 3칸',
    effects: ['1초 점화 준비', '범위 내 모든 적 공격', '0.5초마다 화염 피해'],
  },
  wingedHussar: {
    condition: '8칸 돌진 시',
    effects: ['이동속도 1.8→2.4배', '첫 충돌 피해 9→14(최대)'],
    overrides: { damage: '9→14*', speed: '1.8→2.4배' },
  },
  dragoon: {
    condition: '적과 1.5칸 이내',
    effects: ['총→검 전환', '공격력 8→12', '공격 간격 2→1초', '사거리 6→1.5칸'],
    overrides: { damage: '8→12', dps: '4.00→12.00', attackInterval: '2→1초', range: '6→1.5칸' },
  },
  fenrir: {
    condition: '원거리 병종 상대',
    effects: ['공격력 6→8 (×1.4)', '받는 원거리 피해 60%'],
    overrides: { damage: '6→8*' },
  },
  ronin: {
    condition: '첫 공격',
    effects: ['공격력 10→20', '선딜 없음', '적 0.4초 기절'],
    overrides: { damage: '10→20*' },
  },
  viking: {
    condition: 'HP 50% 이하, 최초 1회·7초',
    effects: ['공격력 19→38', '공격 간격 0.75→0.45초', '이동속도 1.8→2.5배', '받는 피해 40%', '적중 시 HP 1 회복'],
    overrides: { damage: '19→38', dps: '25.33→84.44', attackInterval: '0.75→0.45초', speed: '1.8→2.5배' },
  },
  sanada: {
    condition: '8칸 돌진 / 패링 준비 시',
    effects: ['이동속도 1.8→2.4배', '첫 충돌 피해 22→33(최대)', '공격 무효화 후 2배 반격', '패링 재사용 2초'],
    overrides: { damage: '22→33*', speed: '1.8→2.4배' },
  },
};

export class CodexScene extends Phaser.Scene {
  private index = 0;
  private pageObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() { super('CodexScene'); }

  create(): void {
    const { width, height } = this.scale;
    this.add.image(width / 2, height / 2, 'sky').setDisplaySize(width, height);
    this.add.image(width / 2, height, 'hills').setOrigin(.5, 1).setDisplaySize(width, height);
    this.add.rectangle(width / 2, height / 2, width, height, 0x06100d, .7);

    this.add.graphics()
      .fillStyle(0x08130f, .96).fillRoundedRect(22, 18, width - 44, height - 36, 20)
      .lineStyle(2, 0xbcae6c, .75).strokeRoundedRect(22, 18, width - 44, height - 36, 20)
      .lineStyle(1, 0xffffff, .09).strokeRoundedRect(29, 25, width - 58, height - 50, 15);

    this.add.text(width / 2, 40, '병종 도감', {
      fontFamily: 'Georgia, Pretendard, serif', fontSize: `${Math.min(30, width / 28)}px`, fontStyle: 'bold',
      color: '#e5eaa9', stroke: '#182019', strokeThickness: 4,
    }).setOrigin(.5);

    this.createNavigationButton(48, height / 2, '‹', () => this.changePage(-1));
    this.createNavigationButton(width - 48, height / 2, '›', () => this.changePage(1));
    this.createBackButton(width - 72, 45);

    this.input.keyboard?.on('keydown-LEFT', () => this.changePage(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.changePage(1));
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('StartScene'));

    this.showPage();
  }

  private showPage(): void {
    this.pageObjects.forEach((object) => object.destroy());
    this.pageObjects = [];

    const { width, height } = this.scale;
    const mobileLandscape = height < 450;
    const definition = UNIT_LIST[this.index];
    if (!definition) return;

    const descriptionData = codexDescriptions as Record<UnitKind, { description: string }>;
    const description = descriptionData[definition.kind]?.description.trim() || DESCRIPTION_PLACEHOLDER;
    const headerY = mobileLandscape ? 73 : Math.max(84, height * .105);
    const previewY = mobileLandscape ? 145 : Phaser.Math.Clamp(height * .37, 214, 300);
    const previewHeight = mobileLandscape ? 108 : Phaser.Math.Clamp(height * .29, 150, 235);

    const title = this.add.text(width / 2, headerY, definition.name, {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: `${Math.min(28, width / 30)}px`,
      fontStyle: 'bold', color: '#fff2bd', stroke: '#141b15', strokeThickness: 4,
    }).setOrigin(.5);
    const meta = this.add.text(width / 2, headerY + 29, `${FAMILY_LABELS[definition.family]} · ${TIER_LABELS[definition.tier]} · ${definition.cost}G`, {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: '13px', color: '#b9c9b5',
    }).setOrigin(.5);
    const counter = this.add.text(62, 43, `${this.index + 1} / ${UNIT_LIST.length}`, {
      fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold', color: '#d8ca86',
    }).setOrigin(0, .5);
    this.pageObjects.push(title, meta, counter);

    const previews: Array<{ label: string; animation: 'idle' | 'move' | 'attack'; texture: string }> = [
      { label: '대기', animation: 'idle', texture: definition.texture },
      { label: '이동', animation: 'move', texture: definition.texture },
      { label: '공격', animation: 'attack', texture: definition.texture },
    ];
    const alternateState = ALTERNATE_STATES[definition.kind];
    if (alternateState) previews.push({ label: alternateState.label, animation: 'idle', texture: alternateState.texture });
    const gap = Math.min(24, width * .025);
    const panelWidth = Math.min(220, (width - 150 - gap * (previews.length - 1)) / previews.length);
    const totalWidth = panelWidth * previews.length + gap * (previews.length - 1);
    const firstX = width / 2 - totalWidth / 2 + panelWidth / 2;

    previews.forEach(({ label, animation, texture }, previewIndex) => {
      const x = firstX + previewIndex * (panelWidth + gap);
      const top = previewY - previewHeight / 2;
      const panel = this.add.graphics()
        .fillStyle(0x13231b, .94).fillRoundedRect(x - panelWidth / 2, top, panelWidth, previewHeight, 12)
        .lineStyle(1, 0x7f966a, .75).strokeRoundedRect(x - panelWidth / 2, top, panelWidth, previewHeight, 12)
        .fillStyle(0x9dbd69, .14).fillRoundedRect(x - panelWidth / 2 + 5, top + 5, panelWidth - 10, 28, 8);
      const labelText = this.add.text(x, top + 19, label, {
        fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#dfe9b1',
      }).setOrigin(.5);
      const layout = UNIT_SHEET_BY_KEY.get(texture);
      if (!layout) return;
      const spriteScale = Math.min(.46, panelWidth / layout.frameWidth * .96, (previewHeight - 38) / layout.frameHeight);
      const sprite = this.add.sprite(x + layout.frameOffsetX * spriteScale, top + previewHeight - 8, texture, 0)
        .setOrigin(.5, 1).setScale(spriteScale);
      const animationKey = animation === 'attack' ? `${texture}-codex-attack` : `${texture}-${animation}`;
      if (animation === 'attack' && !this.anims.exists(animationKey)) {
        this.anims.create({
          key: animationKey,
          frames: this.anims.generateFrameNumbers(texture, { start: 8, end: 11 }),
          frameRate: 8,
          repeat: -1,
          repeatDelay: 280,
        });
      }
      sprite.play(animationKey);
      this.pageObjects.push(panel, labelText, sprite);
    });

    const descriptionTop = previewY + previewHeight / 2 + (mobileLandscape ? 7 : 16);
    const descriptionHeight = Math.max(58, height - descriptionTop - (mobileLandscape ? 12 : 52));
    const descriptionPanel = this.add.graphics()
      .fillStyle(0x0c1813, .95).fillRoundedRect(78, descriptionTop, width - 156, descriptionHeight, 10)
      .lineStyle(1, 0x7d7047, .7).strokeRoundedRect(78, descriptionTop, width - 156, descriptionHeight, 10)
      .lineStyle(1, 0x89936f, .22).lineBetween(90, descriptionTop + (mobileLandscape ? 34 : 45), width - 90, descriptionTop + (mobileLandscape ? 34 : 45));
    const conditionalStats = CONDITIONAL_STATS[definition.kind];
    const overrides = conditionalStats?.overrides ?? {};
    const dps = definition.damage / definition.attackInterval;
    const stats = [
      { key: 'hp', label: '체력', value: `${definition.hp}` },
      { key: 'damage', label: '공격력', value: `${definition.damage}` },
      { key: 'dps', label: 'DPS', value: dps.toFixed(2) },
      { key: 'attackInterval', label: '공격 간격', value: `${definition.attackInterval}초` },
      { key: 'range', label: '사거리', value: `${definition.rangeTiles}칸` },
      { key: 'speed', label: '이동속도', value: `${definition.speedMultiplier}배` },
      { key: 'cost', label: '생산 비용', value: `${definition.cost}G` },
    ];
    const statsLeft = 92;
    const statWidth = (width - statsLeft * 2) / stats.length;
    stats.forEach((stat, statIndex) => {
      const statX = statsLeft + statWidth * (statIndex + .5);
      const statLabel = this.add.text(statX, descriptionTop + (mobileLandscape ? 4 : 9), stat.label, {
        fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: mobileLandscape ? '7px' : '9px', color: '#8fa095',
      }).setOrigin(.5, 0);
      const value = overrides[stat.key as CodexStatKey] ?? stat.value;
      const statValue = this.add.text(statX, descriptionTop + (mobileLandscape ? 15 : 23), value, {
        fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: mobileLandscape ? '9px' : (value.length > 10 ? '11px' : '13px'),
        fontStyle: 'bold', color: overrides[stat.key as CodexStatKey] ? '#ffbf69' : '#f0dfa0',
      }).setOrigin(.5, 0);
      this.pageObjects.push(statLabel, statValue);
    });

    let descriptionLabelOffset = mobileLandscape ? 39 : 53;
    let descriptionTextOffset = mobileLandscape ? 53 : 73;
    if (conditionalStats) {
      const conditionalLabel = this.add.text(94, descriptionTop + (mobileLandscape ? 38 : 53), `상황별 스탯  ·  ${conditionalStats.condition}`, {
        fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: mobileLandscape ? '9px' : '12px', fontStyle: 'bold', color: '#ffbd65',
      });
      const conditionalText = this.add.text(94, descriptionTop + (mobileLandscape ? 51 : 72), conditionalStats.effects.join('  ·  '), {
        fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: mobileLandscape ? '8px' : `${Math.min(13, width / 72)}px`,
        color: '#f6dfbb', wordWrap: { width: width - 188 }, lineSpacing: 2, maxLines: 2,
      });
      this.pageObjects.push(conditionalLabel, conditionalText);
      descriptionLabelOffset = mobileLandscape ? 79 : 111;
      descriptionTextOffset = mobileLandscape ? 92 : 131;
    }

    const descriptionLabel = this.add.text(94, descriptionTop + descriptionLabelOffset, '병종 설명', {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: mobileLandscape ? '9px' : '12px', fontStyle: 'bold', color: '#d8c978',
    });
    const descriptionText = this.add.text(94, descriptionTop + descriptionTextOffset, description, {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: `${mobileLandscape ? 9 : Math.min(15, width / 62)}px`,
      color: description === DESCRIPTION_PLACEHOLDER ? '#78847b' : '#e6e2cf',
      wordWrap: { width: width - 188 }, lineSpacing: mobileLandscape ? 1 : 5, maxLines: mobileLandscape ? (conditionalStats ? 2 : 3) : 0,
    });
    this.pageObjects.push(descriptionPanel, descriptionLabel, descriptionText);
  }

  private changePage(direction: -1 | 1): void {
    this.index = Phaser.Math.Wrap(this.index + direction, 0, UNIT_LIST.length);
    this.showPage();
  }

  private createNavigationButton(x: number, y: number, label: string, action: () => void): void {
    const background = this.add.circle(x, y, 25, 0x263b2f, .96).setStrokeStyle(2, 0xcabd72).setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y - 3, label, { fontFamily: 'Georgia, serif', fontSize: '45px', color: '#fff1b2' }).setOrigin(.5);
    background.on('pointerover', () => { background.setScale(1.1); text.setScale(1.1); })
      .on('pointerout', () => { background.setScale(1); text.setScale(1); })
      .on('pointerdown', action);
  }

  private createBackButton(x: number, y: number): void {
    const button = this.add.text(x, y, '× 닫기', {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#e7dfbd',
      backgroundColor: '#25372dcc', padding: { x: 12, y: 8 },
    }).setOrigin(.5).setInteractive({ useHandCursor: true });
    button.on('pointerover', () => button.setColor('#ffffff')).on('pointerout', () => button.setColor('#e7dfbd'))
      .on('pointerdown', () => this.scene.start('StartScene'));
  }
}
