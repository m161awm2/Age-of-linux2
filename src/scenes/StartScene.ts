import Phaser from 'phaser';
import { DIFFICULTIES } from '../data/constants';
import type { Difficulty } from '../data/types';
import { AudioService } from '../services/AudioService';
import { SettingsPanel } from '../ui/SettingsPanel';
import { TutorialProgressService, type MenuTutorialStep } from '../services/TutorialProgressService';
import { AuthService } from '../services/AuthService';
import { HomeChatPanel } from '../ui/HomeChatPanel';
import { PlayerProgressService } from '../services/PlayerProgressService';
import { PresenceService } from '../services/PresenceService';

const DIFFICULTY_STYLES: Record<Difficulty, { top: number; bottom: number; border: number; glow: number; symbol: string; hint: string }> = {
  Easy: { top: 0x39895b, bottom: 0x17452e, border: 0x8be2aa, glow: 0x69d894, symbol: '◆', hint: '입문' },
  Normal: { top: 0x7d8f35, bottom: 0x3d4e19, border: 0xcbe66f, glow: 0xaed255, symbol: '◆◆', hint: '안정' },
  Medium: { top: 0xb18a27, bottom: 0x5d4512, border: 0xffdb67, glow: 0xf0c94f, symbol: '◆◆◆', hint: '균형' },
  Hard: { top: 0xa86a32, bottom: 0x5e3518, border: 0xffb065, glow: 0xe98a42, symbol: '◆◆◆◆', hint: '공세' },
  Impossible: { top: 0xa83b46, bottom: 0x52151f, border: 0xff7181, glow: 0xeb4458, symbol: '◆◆◆◆◆', hint: '극한' },
};

export class StartScene extends Phaser.Scene {
  private tutorialOverlay: Phaser.GameObjects.GameObject[] = [];
  private tutorialTargets: Partial<Record<MenuTutorialStep, Phaser.GameObjects.Container>> = {};

  constructor() { super('StartScene'); }

  create(): void {
    const { width, height } = this.scale;
    PresenceService.start();
    const mobileLandscape = height < 450;
    const settingsPanel = new SettingsPanel();
    AudioService.prepare(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => settingsPanel.destroy());
    if (!TutorialProgressService.isComplete() && !TutorialProgressService.getMenuStep()) {
      this.scene.start('TutorialScene', { forced: true });
      return;
    }

    const skySource = this.textures.get('sky').getSourceImage();
    const movingSky = this.add.tileSprite(width / 2, height / 2, width, height, 'sky')
      .setTileScale(width / skySource.width, height / skySource.height);
    this.tweens.add({
      targets: movingSky,
      tilePositionX: skySource.width,
      duration: 180000,
      ease: 'Linear',
      repeat: -1,
    });
    this.add.image(width / 2, height, 'hills').setOrigin(.5, 1).setDisplaySize(width, height);
    this.add.image(width / 2, height, 'ground').setOrigin(.5, 1).setDisplaySize(width, height);
    this.add.rectangle(width / 2, height / 2, width, height, 0x07120e, .42);
    this.createLogoutButton(width - 70, 36);
    this.add.rectangle(70, 36, 112, 34, 0x142735, .94).setStrokeStyle(1, 0x5792aa, .65);
    this.add.text(47, 36, '💎', {
      fontFamily: 'Apple Color Emoji, sans-serif', fontSize: '15px',
    }).setOrigin(.5);
    this.add.text(66, 33, `${PlayerProgressService.current.gold}`, {
      fontFamily: 'Pretendard, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#9ee8ff',
    }).setOrigin(0, .5);
    const chatPanel = new HomeChatPanel();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => chatPanel.destroy());

    const logoWidth = mobileLandscape ? Math.min(330, width * .5) : Math.min(760, width * .75);
    const logoHeight = mobileLandscape ? Math.min(108, logoWidth / 3) : Math.min(254, width * .25);
    const logo = this.add.image(width / 2, mobileLandscape ? 58 : Math.max(130, height * .23), 'logo')
      .setDisplaySize(logoWidth, logoHeight);
    this.add.text(width / 2, logo.y + logo.displayHeight * .48, '전직의 시대 · 브라우저 전장', {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: `${mobileLandscape ? 11 : Math.min(25, width / 45)}px`,
      fontStyle: 'bold', color: '#f4e5a6', stroke: '#1d2116', strokeThickness: 5,
    }).setOrigin(.5);

    const difficultyModalData = this.createDifficultyModal(width, height);
    const difficultyModal = difficultyModalData.modal;
    const modeModalData = this.createModeModal(width, height, () => {
      modeModal.setVisible(false);
      difficultyModal.setVisible(true);
      if (TutorialProgressService.getMenuStep() === 'campaign') {
        TutorialProgressService.setMenuStep('easy');
        this.showTutorialSpotlight(difficultyModalData.easyButton, 'easy');
      }
    });
    const modeModal = modeModalData.modal;
    const compact = height < 760;
    const menuWidth = mobileLandscape ? Math.min(160, (width * .58 - 42) / 2) : Math.min(250, width * .3);
    const menuHeight = mobileLandscape ? 38 : compact ? 36 : 54;
    const menuGap = mobileLandscape ? 6 : compact ? 4 : 8;
    const menuX = 20 + menuWidth / 2;
    const firstMenuY = mobileLandscape ? 142 : compact ? Math.max(260, height * .38) : Math.max(350, height * .5);
    const menuItems: Array<[string, string, number, () => void, MenuTutorialStep?]> = [
      ['▶', '게임 시작', 0xb8d56f, () => {
        modeModal.setVisible(true);
        if (TutorialProgressService.getMenuStep() === 'gameStart') {
          TutorialProgressService.setMenuStep('campaign');
          this.showTutorialSpotlight(modeModalData.campaignButton, 'campaign');
        }
      }, 'gameStart'],
      ['●', '상점', 0xe0b65e, () => this.scene.start('ShopScene', {
        tutorial: TutorialProgressService.getMenuStep() === 'shop',
      }), 'shop'],
      ['⚙', '설정', 0xe0c36b, () => settingsPanel.open(), 'settings'],
      ['▤', '도감', 0x87c9b0, () => this.scene.start('CodexScene'), 'codex'],
      ['?', '튜토리얼', 0x9db7e0, () => this.scene.start('TutorialScene', { forced: false })],
      ['♛', '랭크', 0xd7b564, () => this.scene.start('RankScene'), 'rank'],
    ];
    menuItems.forEach(([icon, label, accent, action, tutorialTarget], index) => {
      const column = mobileLandscape ? index % 2 : 0;
      const row = mobileLandscape ? Math.floor(index / 2) : index;
      const button = this.createMenuButton(
        menuX + column * (menuWidth + menuGap),
        firstMenuY + row * (menuHeight + menuGap),
        menuWidth, menuHeight, icon, label, accent, action,
      );
      if (tutorialTarget) this.tutorialTargets[tutorialTarget] = button;
    });

    const tutorialStep = TutorialProgressService.getMenuStep();
    const tutorialTarget = tutorialStep ? this.tutorialTargets[tutorialStep] : undefined;
    if (tutorialStep && tutorialTarget) {
      this.showTutorialSpotlight(tutorialTarget, tutorialStep);
    }

    if (!compact) {
      this.add.text(width / 2, height - 24, '유닛 생산 1·2·3·4  ·  전직 5·6  ·  카메라 A/D 또는 ←/→  ·  확대 Q/E 또는 휠', {
        fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: `${Math.min(15, width / 67)}px`, color: '#f1ead2',
        backgroundColor: '#0b1714cc', padding: { x: 14, y: 7 },
      }).setOrigin(.5);
    }

    this.input.keyboard?.on('keydown-ESC', () => {
      if (TutorialProgressService.getMenuStep()) return;
      if (difficultyModal.visible) difficultyModal.setVisible(false);
      else if (modeModal.visible) modeModal.setVisible(false);
    });
  }

  private createModeModal(width: number, height: number, openCampaign: () => void): {
    modal: Phaser.GameObjects.Container;
    campaignButton: Phaser.GameObjects.Container;
  } {
    const backdrop = this.add.rectangle(width / 2, height / 2, width, height, 0x020806, .78)
      .setInteractive({ useHandCursor: true });
    const cardWidth = Math.min(720, width - 56);
    const cardHeight = 300;
    const card = this.add.container(width / 2, height / 2);
    const blocker = this.add.zone(0, 0, cardWidth, cardHeight).setOrigin(.5).setInteractive();
    const shadow = this.add.graphics().fillStyle(0x000000, .5)
      .fillRoundedRect(-cardWidth / 2 + 7, -cardHeight / 2 + 9, cardWidth, cardHeight, 18);
    const panel = this.add.graphics()
      .fillGradientStyle(0x1e3328, 0x1a2d24, 0x0c1712, 0x0a130f, 1)
      .fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 18)
      .lineStyle(2, 0xb9a768, .9).strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 18);
    const title = this.add.text(0, -112, '게임 모드 선택', {
      fontFamily: 'Georgia, Pretendard, serif', fontSize: '28px', fontStyle: 'bold', color: '#edf0b5',
      stroke: '#101711', strokeThickness: 4,
    }).setOrigin(.5);
    const subtitle = this.add.text(0, -79, '원하는 전장을 선택하세요', {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: '12px', color: '#aab6a5',
    }).setOrigin(.5);
    const close = this.add.text(cardWidth / 2 - 23, -cardHeight / 2 + 18, '×', {
      fontFamily: 'sans-serif', fontSize: '28px', color: '#d8d1b4',
    }).setOrigin(.5).setInteractive({ useHandCursor: true });
    card.add([shadow, panel, blocker, title, subtitle, close]);

    const optionWidth = Math.min(285, (cardWidth - 70) / 2);
    const campaign = this.createModeButton(-optionWidth / 2 - 10, 28, optionWidth, '⚔', '캠페인 모드',
      'AI가 지키는 기지를 함락하세요', 0x9fc45a, openCampaign);
    const versus = this.createModeButton(optionWidth / 2 + 10, 28, optionWidth, '⚑', '1대1 모드',
      '방을 만들거나 코드로 참가하세요', 0xe0b65e, () => this.scene.start('OnlineLobbyScene'));
    card.add([campaign, versus]);

    const modal = this.add.container(0, 0, [backdrop, card]).setDepth(210).setVisible(false);
    backdrop.on('pointerdown', () => modal.setVisible(false));
    close.on('pointerover', () => close.setColor('#ffffff')).on('pointerout', () => close.setColor('#d8d1b4'))
      .on('pointerdown', () => modal.setVisible(false));
    return { modal, campaignButton: campaign };
  }

  private createModeButton(
    x: number,
    y: number,
    width: number,
    icon: string,
    title: string,
    description: string,
    accent: number,
    action: () => void,
  ): Phaser.GameObjects.Container {
    const panel = this.add.graphics()
      .fillGradientStyle(0x304a39, 0x294132, 0x17271f, 0x122019, 1)
      .fillRoundedRect(-width / 2, -67, width, 134, 14)
      .lineStyle(2, accent, .85).strokeRoundedRect(-width / 2, -67, width, 134, 14);
    const iconText = this.add.text(0, -35, icon, {
      fontFamily: 'Georgia, serif', fontSize: '30px', color: `#${accent.toString(16).padStart(6, '0')}`,
    }).setOrigin(.5);
    const titleText = this.add.text(0, 2, title, {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: '21px', fontStyle: 'bold', color: '#fff8df',
    }).setOrigin(.5);
    const descriptionText = this.add.text(0, 34, description, {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: '11px', color: '#c2ccb9',
      align: 'center', wordWrap: { width: width - 30 },
    }).setOrigin(.5);
    const hitArea = this.add.zone(0, 0, width, 134).setInteractive({ useHandCursor: true });
    const button = this.add.container(x, y, [panel, iconText, titleText, descriptionText, hitArea]);
    hitArea.on('pointerover', () => button.setScale(1.035))
      .on('pointerout', () => button.setScale(1))
      .on('pointerdown', action);
    return button;
  }

  private createLogoutButton(x: number, y: number): void {
    const background = this.add.rectangle(x, y, 112, 34, 0x17271f, .94)
      .setStrokeStyle(1, 0x887c59).setInteractive({ useHandCursor: true });
    const label = this.add.text(x, y, '로그아웃', {
      fontFamily: 'Pretendard, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#e9dfbc',
    }).setOrigin(.5);
    background.on('pointerover', () => background.setFillStyle(0x2b4335))
      .on('pointerout', () => background.setFillStyle(0x17271f))
      .on('pointerdown', () => {
        background.disableInteractive();
        label.setText('처리 중…');
        void AuthService.signOut().finally(() => this.scene.start('AuthScene'));
      });
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
  ): Phaser.GameObjects.Container {
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
    return button;
  }

  private createDifficultyModal(width: number, height: number): {
    modal: Phaser.GameObjects.Container;
    easyButton: Phaser.GameObjects.Container;
  } {
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

    const difficulties: Difficulty[] = ['Easy', 'Normal', 'Medium', 'Hard', 'Impossible'];
    const buttonWidth = Math.min(145, (cardWidth - 90) / difficulties.length);
    const gap = Math.min(14, (cardWidth - buttonWidth * difficulties.length) / (difficulties.length + 1));
    let easyButton: Phaser.GameObjects.Container | null = null;
    difficulties.forEach((difficulty, index) => {
      const x = (index - (difficulties.length - 1) / 2) * (buttonWidth + gap);
      const button = this.createDifficultyButton(x, 25, buttonWidth, difficulty);
      card.add(button);
      if (difficulty === 'Easy') easyButton = button;
    });
    const help = this.add.text(0, 102, '난이도는 적 기지 체력과 AI 생산 속도에 영향을 줍니다.', {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: '11px', color: '#7f9084',
    }).setOrigin(.5);
    card.add(help);

    const modal = this.add.container(0, 0, [backdrop, card]).setDepth(200).setVisible(false);
    backdrop.on('pointerdown', () => modal.setVisible(false));
    close.on('pointerover', () => close.setColor('#ffffff')).on('pointerout', () => close.setColor('#d8d1b4'))
      .on('pointerdown', () => modal.setVisible(false));
    return { modal, easyButton: easyButton! };
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
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: `${Math.min(21, Math.max(10, width / 4.2))}px`, fontStyle: 'bold', color: '#fff8df',
      stroke: '#1a160d', strokeThickness: 3,
    }).setOrigin(.5);
    const detail = this.add.text(0, 14, `기지 ${config.enemyBaseHp} HP`, {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: `${Math.min(11, Math.max(8, width / 7))}px`, color: '#fff3cf',
    }).setOrigin(.5);
    const hint = this.add.text(0, 31, style.hint, {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: '9px', color: '#fffbe6',
    }).setAlpha(.72).setOrigin(.5);
    const hitArea = this.add.zone(0, 0, width, 84).setInteractive({ useHandCursor: true });
    const button = this.add.container(x, y, [panel, symbol, title, detail, hint, hitArea]);
    let pressedHere = false;
    hitArea.on('pointerover', () => button.setScale(1.045))
      .on('pointerout', () => {
        pressedHere = false;
        button.setScale(1);
      })
      .on('pointerdown', () => {
        pressedHere = true;
        button.setScale(1.01);
      })
      .on('pointerup', () => {
        if (!pressedHere) return;
        pressedHere = false;
        if (difficulty === 'Easy' && TutorialProgressService.getMenuStep() === 'easy') {
          TutorialProgressService.complete();
          this.clearTutorialOverlay();
        }
        this.scene.start('GameScene', { difficulty });
      })
      .on('pointerupoutside', () => {
        pressedHere = false;
        button.setScale(1);
      });
    return button;
  }

  private showTutorialSpotlight(target: Phaser.GameObjects.Container, step: MenuTutorialStep): void {
    this.clearTutorialOverlay();
    const { width, height } = this.scale;
    const bounds = target.getBounds();
    const padding = 9;
    const left = Math.max(0, bounds.left - padding);
    const right = Math.min(width, bounds.right + padding);
    const top = Math.max(0, bounds.top - padding);
    const bottom = Math.min(height, bounds.bottom + padding);
    const blocker = (x: number, y: number, w: number, h: number): Phaser.GameObjects.Rectangle | null => {
      if (w <= 0 || h <= 0) return null;
      return this.add.rectangle(x, y, w, h, 0x020806, .82)
        .setDepth(500).setInteractive();
    };
    const pieces = [
      blocker(width / 2, top / 2, width, top),
      blocker(width / 2, bottom + (height - bottom) / 2, width, height - bottom),
      blocker(left / 2, top + (bottom - top) / 2, left, bottom - top),
      blocker(right + (width - right) / 2, top + (bottom - top) / 2, width - right, bottom - top),
    ].filter((object): object is Phaser.GameObjects.Rectangle => object !== null);
    const outline = this.add.graphics().setDepth(501)
      .lineStyle(3, 0xf2d76f, 1).strokeRoundedRect(left, top, right - left, bottom - top, 12);
    this.tweens.add({ targets: outline, alpha: .35, duration: 650, yoyo: true, repeat: -1 });

    const copy: Record<MenuTutorialStep, { title: string; text: string }> = {
      shop: { title: '첫 스페셜 유닛 구매', text: '상점을 열고 사무라이·바이킹 계열 중 하나를 구매해 주세요.' },
      settings: { title: '설정', text: '배경음악 음량을 조절하고 저장할 수 있습니다.' },
      codex: { title: '병종 도감', text: '모든 병종의 능력치, 특징과 전직 계보를 확인합니다.' },
      rank: { title: '랭크', text: '난이도별 기록과 상위권의 병종 조합을 비교합니다.' },
      gameStart: { title: '1. 게임 시작', text: '강조된 게임 시작 버튼을 눌러 주세요.' },
      campaign: { title: '2. 캠페인 모드', text: 'AI와 싸우는 캠페인 모드를 선택해 주세요.' },
      easy: { title: '3. 쉬움 선택', text: '쉬움을 눌러 첫 캠페인을 시작해 주세요.' },
    };
    const informational = step === 'settings' || step === 'codex' || step === 'rank';
    const promptWidth = Math.min(390, width - 36);
    const promptHeight = informational ? 108 : 76;
    const preferredY = bottom + 58;
    const promptY = preferredY + promptHeight / 2 < height - 20 ? preferredY : Math.max(66, top - 58);
    const promptX = Phaser.Math.Clamp((left + right) / 2, promptWidth / 2 + 18, width - promptWidth / 2 - 18);
    const prompt = this.add.container(promptX, promptY).setDepth(510);
    const promptBg = this.add.rectangle(0, 0, promptWidth, promptHeight, 0x14271e, .98)
      .setStrokeStyle(2, 0xe2c55e);
    const promptTitle = this.add.text(0, informational ? -29 : -16, copy[step].title, {
      fontFamily: 'Pretendard, sans-serif', fontSize: '17px', fontStyle: 'bold', color: '#fff0a8',
    }).setOrigin(.5);
    const promptText = this.add.text(0, informational ? 0 : 15, copy[step].text, {
      fontFamily: 'Pretendard, sans-serif', fontSize: '13px', color: '#f0eee1',
    }).setOrigin(.5);
    prompt.add([promptBg, promptTitle, promptText]);

    if (informational) {
      const targetBlocker = this.add.rectangle((left + right) / 2, (top + bottom) / 2, right - left, bottom - top, 0x000000, .001)
        .setDepth(505).setInteractive();
      const nextBg = this.add.rectangle(0, 32, 92, 30, 0x607b31, 1)
        .setStrokeStyle(1, 0xd7e77f).setInteractive({ useHandCursor: true });
      const nextText = this.add.text(0, 32, '다음 →', {
        fontFamily: 'Pretendard, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#fff5d3',
      }).setOrigin(.5);
      nextBg.on('pointerdown', () => this.advanceMenuTutorial(step));
      prompt.add([nextBg, nextText]);
      this.tutorialOverlay.push(targetBlocker);
    }

    const skipBg = this.add.rectangle(width - 72, 34, 124, 38, 0x263b30, .98)
      .setStrokeStyle(1, 0xd7c978).setDepth(520).setInteractive({ useHandCursor: true });
    const skipText = this.add.text(width - 72, 34, '건너뛰기', {
      fontFamily: 'Pretendard, sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#fff5d3',
    }).setOrigin(.5).setDepth(521);
    skipBg.on('pointerdown', () => {
      TutorialProgressService.complete();
      this.clearTutorialOverlay();
      this.scene.restart();
    });
    this.tutorialOverlay.push(...pieces, outline, prompt, skipBg, skipText);
  }

  private clearTutorialOverlay(): void {
    this.tutorialOverlay.forEach((object) => object.destroy());
    this.tutorialOverlay = [];
  }

  private advanceMenuTutorial(step: 'settings' | 'codex' | 'rank'): void {
    const next: Record<typeof step, MenuTutorialStep> = {
      settings: 'codex',
      codex: 'rank',
      rank: 'gameStart',
    };
    const nextStep = next[step];
    const nextTarget = this.tutorialTargets[nextStep];
    if (!nextTarget) return;
    TutorialProgressService.setMenuStep(nextStep);
    this.showTutorialSpotlight(nextTarget, nextStep);
  }
}
