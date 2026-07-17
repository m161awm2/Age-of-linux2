import Phaser from 'phaser';
import { AudioService } from '../services/AudioService';
import { TutorialProgressService } from '../services/TutorialProgressService';

interface TutorialLaunchData { forced?: boolean }

const TUTORIAL_PAGES = [
  {
    icon: '⚔',
    title: '전장의 목표',
    text: '아군 목재 역참은 왼쪽, 적군 석조 성은 오른쪽에 있습니다.\n\n유닛을 생산해 적진으로 보내고 적 기지의 체력을 먼저 0으로 만들면 승리합니다. 아군 기지가 먼저 무너지면 패배합니다.',
    tip: '화면 위쪽에서 양쪽 기지 체력을 항상 확인할 수 있습니다.',
  },
  {
    icon: '🪙',
    title: '골드와 유닛 생산',
    text: '골드는 시간이 지나면 자동으로 모입니다. 화면 아래 생산 버튼을 누르면 해당 비용을 사용해 유닛을 생산합니다.\n\n단축키 1·2·3·4로 보병, 궁병, 기병, 스페셜 병종을 빠르게 생산할 수도 있습니다.',
    tip: '비싼 유닛 하나보다 값싼 유닛으로 전선을 먼저 유지하는 선택도 중요합니다.',
  },
  {
    icon: '➜',
    title: '자동 이동과 전투',
    text: '생산된 유닛은 적 기지를 향해 자동으로 전진합니다. 적이 사정거리에 들어오면 이동하면서 공격하며, 공격 피해는 실제 공격 모션의 타격 순간에 적용됩니다.\n\n앞의 아군이 길을 막으면 뒤 유닛은 간격을 유지하며 따라갑니다.',
    tip: '보병은 앞에서 버티고 궁병은 뒤에서 지원하도록 조합해 보세요.',
  },
  {
    icon: '✦',
    title: '전직과 특수 능력',
    text: '전투 골드를 모아 전직 버튼 또는 단축키 5를 누르면 현재 생산 병종을 더 강한 병종으로 교체할 수 있습니다. 단축키 6은 먼저 로닌·펜리르 계열을 선택하고, 다음 단계에서 사나다 사무라이·바이킹 광전사 전직을 엽니다.\n\n계정 보석은 캠페인 승리 보상으로 얻고, 메인 메뉴 상점에서 스페셜 병종을 해금하는 데 사용합니다.',
    tip: '첫 스페셜 계열 선택에는 전투 골드 20G가 필요합니다.',
  },
  {
    icon: '⌖',
    title: '카메라 조작',
    text: 'A·D 또는 ←·→ 키로 전장을 좌우로 이동합니다. Q·E 키나 마우스 휠로 확대·축소할 수 있으며, 마우스로 전장을 드래그해 좌우로 움직일 수도 있습니다.\n\n오른쪽 위 카메라 버튼으로도 같은 조작을 할 수 있습니다.',
    tip: '전선을 넓게 보려면 축소하고, 중요한 교전은 확대해서 살펴보세요.',
  },
  {
    icon: '★',
    title: '메인 메뉴로 이동합니다',
    text: '기본 설명은 모두 끝났습니다. 다음 화면에서는 상점에서 첫 스페셜 병종을 해금한 뒤 설정, 도감, 랭크 버튼을 차례로 안내합니다.\n\n안내가 끝나면 게임 시작, 캠페인 모드, 쉬움을 직접 눌러 첫 전투를 시작합니다.',
    tip: '안내를 끝내고 싶다면 화면 오른쪽 위의 건너뛰기를 누를 수 있습니다.',
  },
] as const;

export class TutorialScene extends Phaser.Scene {
  private page = 0;
  private forced = false;
  private pageObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() { super('TutorialScene'); }

  init(data: TutorialLaunchData): void {
    this.forced = data.forced === true;
    this.page = 0;
  }

  create(): void {
    const { width, height } = this.scale;
    AudioService.prepare(this);
    this.add.image(width / 2, height / 2, 'sky').setDisplaySize(width, height);
    this.add.image(width / 2, height, 'hills').setOrigin(.5, 1).setDisplaySize(width, height);
    this.add.rectangle(width / 2, height / 2, width, height, 0x06100d, .72);
    this.add.graphics()
      .fillStyle(0x091711, .97).fillRoundedRect(22, 18, width - 44, height - 36, 20)
      .lineStyle(2, 0xb8a766, .8).strokeRoundedRect(22, 18, width - 44, height - 36, 20)
      .lineStyle(1, 0xffffff, .08).strokeRoundedRect(29, 25, width - 58, height - 50, 15);

    this.add.text(width / 2, 43, '게임 튜토리얼', {
      fontFamily: 'Georgia, Pretendard, serif', fontSize: `${Math.min(30, width / 27)}px`, fontStyle: 'bold',
      color: '#e8ecad', stroke: '#111b14', strokeThickness: 4,
    }).setOrigin(.5);
    if (this.forced) {
      this.add.text(48, 43, '첫 방문 필수 안내', {
        fontFamily: 'Pretendard, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#f3dc84',
        backgroundColor: '#4a3818cc', padding: { x: 9, y: 6 },
      }).setOrigin(0, .5);
    }
    this.createButton(width - 82, 44, 112, 34, '건너뛰기', () => this.skip(), false);

    this.input.keyboard?.on('keydown-LEFT', () => this.changePage(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.changePage(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.next());
    this.input.keyboard?.on('keydown-ESC', () => { if (!this.forced) this.scene.start('StartScene'); });
    this.showPage();
  }

  private showPage(): void {
    this.pageObjects.forEach((object) => object.destroy());
    this.pageObjects = [];
    const { width, height } = this.scale;
    const content = TUTORIAL_PAGES[this.page];
    if (!content) return;
    const mobileLandscape = height < 450;
    const compact = height < 620;
    const cardTop = mobileLandscape ? 66 : compact ? 78 : 90;
    const cardBottom = height - (mobileLandscape ? 58 : compact ? 75 : 92);
    const cardHeight = cardBottom - cardTop;
    const card = this.add.graphics()
      .fillGradientStyle(0x1b3025, 0x17291f, 0x0e1c15, 0x0b1712, .98)
      .fillRoundedRect(64, cardTop, width - 128, cardHeight, 16)
      .lineStyle(1, 0x71825b, .8).strokeRoundedRect(64, cardTop, width - 128, cardHeight, 16);
    const icon = this.add.text(width / 2, cardTop + (mobileLandscape ? 20 : compact ? 35 : 47), content.icon, {
      fontFamily: 'Georgia, Apple Color Emoji, sans-serif', fontSize: mobileLandscape ? '22px' : compact ? '35px' : '46px', color: '#e8cf70',
    }).setOrigin(.5);
    const title = this.add.text(width / 2, cardTop + (mobileLandscape ? 43 : compact ? 72 : 98), content.title, {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: mobileLandscape ? '16px' : compact ? '22px' : '28px', fontStyle: 'bold',
      color: '#fff1b8', stroke: '#111912', strokeThickness: 3,
    }).setOrigin(.5);
    const bodyTop = cardTop + (mobileLandscape ? 65 : compact ? 103 : 140);
    const body = this.add.text(width / 2, bodyTop, content.text, {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: `${mobileLandscape ? 11 : compact ? 13 : Math.min(17, width / 62)}px`,
      color: '#e3e5d8', align: 'center', lineSpacing: mobileLandscape ? 1 : compact ? 3 : 7,
      wordWrap: { width: width - (mobileLandscape ? 150 : 200) },
    }).setOrigin(.5, 0);
    const tip = this.add.text(width / 2, cardBottom - (mobileLandscape ? 20 : compact ? 36 : 44), `TIP · ${content.tip}`, {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: mobileLandscape ? '9px' : compact ? '11px' : '13px',
      color: '#c9d990', align: 'center', backgroundColor: '#0c1712cc', padding: { x: 14, y: 8 },
      wordWrap: { width: width - 220 },
    }).setOrigin(.5);
    const counter = this.add.text(width / 2, height - (mobileLandscape ? 31 : compact ? 52 : 63), `${this.page + 1} / ${TUTORIAL_PAGES.length}`, {
      fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold', color: '#b8ae7c',
    }).setOrigin(.5);
    this.pageObjects.push(card, icon, title, body, tip, counter);

    const navigationY = height - (mobileLandscape ? 29 : compact ? 49 : 59);
    const navigationHeight = mobileLandscape ? 34 : 42;
    if (this.page > 0) this.pageObjects.push(...this.createButton(mobileLandscape ? 88 : 116, navigationY, mobileLandscape ? 104 : 130, navigationHeight, '← 이전', () => this.changePage(-1)));
    const lastPage = this.page === TUTORIAL_PAGES.length - 1;
    this.pageObjects.push(...this.createButton(width - (mobileLandscape ? 88 : 116), navigationY, lastPage ? (mobileLandscape ? 142 : 170) : (mobileLandscape ? 104 : 130), navigationHeight, lastPage ? '튜토리얼 완료' : '다음 →', () => this.next(), lastPage));
  }

  private next(): void {
    if (this.page < TUTORIAL_PAGES.length - 1) this.changePage(1);
    else {
      TutorialProgressService.beginMenuWalkthrough();
      this.scene.start('StartScene');
    }
  }

  private skip(): void {
    TutorialProgressService.complete();
    this.scene.start('StartScene');
  }

  private changePage(direction: -1 | 1): void {
    this.page = Phaser.Math.Clamp(this.page + direction, 0, TUTORIAL_PAGES.length - 1);
    this.showPage();
  }

  private createButton(x: number, y: number, width: number, height: number, label: string, action: () => void, primary = false): Phaser.GameObjects.GameObject[] {
    const background = this.add.rectangle(x, y, width, height, primary ? 0x607b31 : 0x263b30, .98)
      .setStrokeStyle(1, primary ? 0xd7e77f : 0x9d996c).setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y, label, {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#fff5d3',
    }).setOrigin(.5);
    background.on('pointerover', () => { background.setScale(1.04); text.setScale(1.04); })
      .on('pointerout', () => { background.setScale(1); text.setScale(1); })
      .on('pointerdown', action);
    return [background, text];
  }
}
