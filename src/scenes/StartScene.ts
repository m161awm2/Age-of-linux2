import Phaser from 'phaser';
import { DIFFICULTIES } from '../data/constants';
import type { Difficulty } from '../data/types';
import { AudioService } from '../services/AudioService';
import { SettingsPanel } from '../ui/SettingsPanel';
import { TutorialProgressService } from '../services/TutorialProgressService';

const DIFFICULTY_STYLES: Record<Difficulty, { top: number; bottom: number; border: number; glow: number; symbol: string; hint: string }> = {
  Easy: { top: 0x39895b, bottom: 0x17452e, border: 0x8be2aa, glow: 0x69d894, symbol: '◆', hint: '여유로운 전투' },
  Medium: { top: 0xb18a27, bottom: 0x5d4512, border: 0xffdb67, glow: 0xf0c94f, symbol: '◆◆', hint: '균형 잡힌 전투' },
  Hard: { top: 0xa8453e, bottom: 0x5e211f, border: 0xff8e7e, glow: 0xf06a5d, symbol: '◆◆◆', hint: '거센 적의 공세' },
};

export class StartScene extends Phaser.Scene {
  constructor() { super('StartScene'); }

  create(): void {
    const { width, height } = this.scale;
    const settingsPanel = new SettingsPanel();
    AudioService.prepare(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => settingsPanel.destroy());
    if (!TutorialProgressService.isComplete()) {
      this.scene.start('TutorialScene', { forced: true });
      return;
    }

    this.add.image(width / 2, height / 2, 'sky').setDisplaySize(width, height);
    this.add.image(width / 2, height, 'hills').setOrigin(.5, 1).setDisplaySize(width, height);
    this.add.image(width / 2, height, 'ground').setOrigin(.5, 1).setDisplaySize(width, height);
    this.add.rectangle(width / 2, height / 2, width, height, 0x07120e, .42);

    const logo = this.add.image(width / 2, Math.max(130, height * .23), 'logo')
      .setDisplaySize(Math.min(760, width * .75), Math.min(254, width * .25));
    this.add.text(width / 2, logo.y + logo.displayHeight * .48, '전직의 시대 · 브라우저 전장', {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: `${Math.min(25, width / 45)}px`,
      fontStyle: 'bold', color: '#f4e5a6', stroke: '#1d2116', strokeThickness: 5,
    }).setOrigin(.5);

    const difficultyModal = this.createDifficultyModal(width, height);
    const compact = height < 700;
    const menuWidth = Math.min(250, width * .3);
    const menuHeight = compact ? 46 : 58;
    const menuGap = compact ? 8 : 10;
    const menuX = 24 + menuWidth / 2;
    const firstMenuY = compact ? Math.max(250, height * .45) : Math.max(350, height * .52);
    this.createMenuButton(menuX, firstMenuY, menuWidth, menuHeight, '▶', '게임 시작', 0xb8d56f, () => difficultyModal.setVisible(true));
    this.createMenuButton(menuX, firstMenuY + menuHeight + menuGap, menuWidth, menuHeight, '⚙', '설정', 0xe0c36b, () => settingsPanel.open());
    this.createMenuButton(menuX, firstMenuY + (menuHeight + menuGap) * 2, menuWidth, menuHeight, '▤', '도감', 0x87c9b0, () => this.scene.start('CodexScene'));
    this.createMenuButton(menuX, firstMenuY + (menuHeight + menuGap) * 3, menuWidth, menuHeight, '?', '튜토리얼', 0x9db7e0, () => this.scene.start('TutorialScene', { forced: false }));

    this.add.text(width / 2, height - 24, '유닛 생산 1·2·3·4  ·  전직 5·6  ·  카메라 A/D 또는 ←/→  ·  확대 Q/E 또는 휠', {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: `${Math.min(15, width / 67)}px`, color: '#f1ead2',
      backgroundColor: '#0b1714cc', padding: { x: 14, y: 7 },
    }).setOrigin(.5);

    this.input.keyboard?.on('keydown-ESC', () => { if (difficultyModal.visible) difficultyModal.setVisible(false); });
  }

  private createMenuButton(
    x: number,
    y: number,
    width: number,
    height: number,
    icon: string,
    label: string,
    accent: number,
    action: () => void,
  ): void {
    const shadow = this.add.graphics().fillStyle(0x020604, .58).fillRoundedRect(-width / 2 + 5, -height / 2 + 6, width, height, 11);
    const panel = this.add.graphics()
      .fillGradientStyle(0x2b4335, 0x263d30, 0x14241c, 0x101d17, .98)
      .fillRoundedRect(-width / 2, -height / 2, width, height, 11)
      .lineStyle(1, accent, .8).strokeRoundedRect(-width / 2, -height / 2, width, height, 11)
      .fillStyle(accent, .9).fillRoundedRect(-width / 2 + 6, -height / 2 + 7, 4, height - 14, 2);
    const iconText = this.add.text(-width / 2 + 31, 0, icon, {
      fontFamily: 'Georgia, Pretendard, serif', fontSize: '18px', fontStyle: 'bold', color: `#${accent.toString(16).padStart(6, '0')}`,
    }).setOrigin(.5);
    const labelText = this.add.text(-width / 2 + 57, 0, label, {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: '19px', fontStyle: 'bold', color: '#fff6d7',
      stroke: '#0d1510', strokeThickness: 3,
    }).setOrigin(0, .5);
    const hitArea = this.add.zone(0, 0, width, height).setInteractive({ useHandCursor: true });
    const button = this.add.container(x, y, [shadow, panel, iconText, labelText, hitArea]);
    hitArea.on('pointerover', () => {
      this.tweens.killTweensOf(button);
      this.tweens.add({ targets: button, x: x + 7, scaleX: 1.025, scaleY: 1.025, duration: 110, ease: 'Sine.Out' });
    }).on('pointerout', () => {
      this.tweens.killTweensOf(button);
      this.tweens.add({ targets: button, x, scaleX: 1, scaleY: 1, duration: 110, ease: 'Sine.Out' });
    }).on('pointerdown', action);
  }

  private createDifficultyModal(width: number, height: number): Phaser.GameObjects.Container {
    const backdrop = this.add.rectangle(width / 2, height / 2, width, height, 0x020806, .76)
      .setInteractive({ useHandCursor: true });
    const cardWidth = Math.min(700, width - 56);
    const cardHeight = 260;
    const card = this.add.container(width / 2, height / 2);
    const blocker = this.add.zone(0, 0, cardWidth, cardHeight).setOrigin(.5).setInteractive();
    const shadow = this.add.graphics().fillStyle(0x000000, .5).fillRoundedRect(-cardWidth / 2 + 7, -cardHeight / 2 + 9, cardWidth, cardHeight, 18);
    const panel = this.add.graphics()
      .fillGradientStyle(0x1e3328, 0x1a2d24, 0x0c1712, 0x0a130f, 1)
      .fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 18)
      .lineStyle(2, 0xb9a768, .9).strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 18)
      .lineStyle(1, 0xffffff, .09).strokeRoundedRect(-cardWidth / 2 + 7, -cardHeight / 2 + 7, cardWidth - 14, cardHeight - 14, 13);
    const title = this.add.text(0, -96, '난이도 선택', {
      fontFamily: 'Georgia, Pretendard, serif', fontSize: '27px', fontStyle: 'bold', color: '#edf0b5',
      stroke: '#101711', strokeThickness: 4,
    }).setOrigin(.5);
    const subtitle = this.add.text(0, -68, '전투를 시작할 난이도를 선택하세요', {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: '12px', color: '#aab6a5',
    }).setOrigin(.5);
    const close = this.add.text(cardWidth / 2 - 23, -cardHeight / 2 + 18, '×', {
      fontFamily: 'sans-serif', fontSize: '28px', color: '#d8d1b4',
    }).setOrigin(.5).setInteractive({ useHandCursor: true });
    card.add([shadow, panel, blocker, title, subtitle, close]);

    const difficulties: Difficulty[] = ['Easy', 'Medium', 'Hard'];
    const buttonWidth = Math.min(184, (cardWidth - 80) / 3);
    const gap = Math.min(20, (cardWidth - buttonWidth * 3) / 4);
    difficulties.forEach((difficulty, index) => {
      const x = (index - 1) * (buttonWidth + gap);
      card.add(this.createDifficultyButton(x, 25, buttonWidth, difficulty));
    });
    const help = this.add.text(0, 102, '난이도는 적 기지 체력과 AI 생산 속도에 영향을 줍니다.', {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: '11px', color: '#7f9084',
    }).setOrigin(.5);
    card.add(help);

    const modal = this.add.container(0, 0, [backdrop, card]).setDepth(200).setVisible(false);
    backdrop.on('pointerdown', () => modal.setVisible(false));
    close.on('pointerover', () => close.setColor('#ffffff')).on('pointerout', () => close.setColor('#d8d1b4'))
      .on('pointerdown', () => modal.setVisible(false));
    return modal;
  }

  private createDifficultyButton(x: number, y: number, width: number, difficulty: Difficulty): Phaser.GameObjects.Container {
    const config = DIFFICULTIES[difficulty];
    const style = DIFFICULTY_STYLES[difficulty];
    const panel = this.add.graphics()
      .fillGradientStyle(style.top, style.top, style.bottom, style.bottom, 1)
      .fillRoundedRect(-width / 2, -42, width, 84, 12)
      .lineStyle(2, style.border, 1).strokeRoundedRect(-width / 2, -42, width, 84, 12)
      .lineStyle(1, 0xffffff, .18).strokeRoundedRect(-width / 2 + 5, -37, width - 10, 74, 8)
      .fillStyle(style.glow, .9).fillRoundedRect(-width / 2 + 10, -36, width - 20, 3, 2);
    const symbol = this.add.text(0, -28, style.symbol, {
      fontFamily: 'Georgia, serif', fontSize: '10px', color: `#${style.border.toString(16).padStart(6, '0')}`,
    }).setOrigin(.5);
    const title = this.add.text(0, -8, config.label, {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: '21px', fontStyle: 'bold', color: '#fff8df',
      stroke: '#1a160d', strokeThickness: 3,
    }).setOrigin(.5);
    const detail = this.add.text(0, 14, `적 기지 ${config.enemyBaseHp} HP`, {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: '11px', color: '#fff3cf',
    }).setOrigin(.5);
    const hint = this.add.text(0, 31, style.hint, {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: '9px', color: '#fffbe6',
    }).setAlpha(.72).setOrigin(.5);
    const hitArea = this.add.zone(0, 0, width, 84).setInteractive({ useHandCursor: true });
    const button = this.add.container(x, y, [panel, symbol, title, detail, hint, hitArea]);
    hitArea.on('pointerover', () => button.setScale(1.045))
      .on('pointerout', () => button.setScale(1))
      .on('pointerdown', () => button.setScale(1.01))
      .on('pointerup', () => this.scene.start('GameScene', { difficulty }));
    return button;
  }
}
