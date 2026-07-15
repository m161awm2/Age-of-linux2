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
    const dps = definition.damage / definition.attackInterval;
    const stats = [
      { label: '체력', value: `${definition.hp}` },
      { label: '공격력', value: `${definition.damage}` },
      { label: 'DPS', value: dps.toFixed(2) },
      { label: '공격 간격', value: `${definition.attackInterval}초` },
      { label: '사거리', value: `${definition.rangeTiles}칸` },
      { label: '이동속도', value: `${definition.speedMultiplier}배` },
      { label: '생산 비용', value: `${definition.cost}G` },
    ];
    const statsLeft = 92;
    const statWidth = (width - statsLeft * 2) / stats.length;
    stats.forEach((stat, statIndex) => {
      const statX = statsLeft + statWidth * (statIndex + .5);
      const statLabel = this.add.text(statX, descriptionTop + (mobileLandscape ? 4 : 9), stat.label, {
        fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: mobileLandscape ? '7px' : '9px', color: '#8fa095',
      }).setOrigin(.5, 0);
      const statValue = this.add.text(statX, descriptionTop + (mobileLandscape ? 15 : 23), stat.value, {
        fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: mobileLandscape ? '10px' : '13px', fontStyle: 'bold', color: '#f0dfa0',
      }).setOrigin(.5, 0);
      this.pageObjects.push(statLabel, statValue);
    });
    const descriptionLabel = this.add.text(94, descriptionTop + (mobileLandscape ? 39 : 53), '병종 설명', {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: mobileLandscape ? '9px' : '12px', fontStyle: 'bold', color: '#d8c978',
    });
    const descriptionText = this.add.text(94, descriptionTop + (mobileLandscape ? 53 : 73), description, {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: `${mobileLandscape ? 9 : Math.min(15, width / 62)}px`,
      color: description === DESCRIPTION_PLACEHOLDER ? '#78847b' : '#e6e2cf',
      wordWrap: { width: width - 188 }, lineSpacing: mobileLandscape ? 1 : 5, maxLines: mobileLandscape ? 3 : 0,
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
