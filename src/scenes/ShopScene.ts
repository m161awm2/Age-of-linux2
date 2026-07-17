import Phaser from 'phaser';
import { SPECIAL_UNLOCK_COST } from '../data/constants';
import type { UnitKind } from '../data/types';
import { UNITS } from '../data/units';
import { AudioService } from '../services/AudioService';
import { PlayerProgressService, type SpecialPath } from '../services/PlayerProgressService';
import { TutorialProgressService } from '../services/TutorialProgressService';

interface ShopLaunchData { tutorial?: boolean }

interface ShopCatalogEntry {
  unit: UnitKind;
  path: SpecialPath;
}

// 엘리트 병종을 포함한 스페셜 유닛 전체를 표시하고, 같은 계열은 한 번의 구매로 함께 해금한다.
const SHOP_CATALOG: ShopCatalogEntry[] = [
  { unit: 'ronin', path: 'ronin' },
  { unit: 'sanada', path: 'ronin' },
  { unit: 'fenrir', path: 'fenrir' },
  { unit: 'viking', path: 'fenrir' },
];

export class ShopScene extends Phaser.Scene {
  private tutorial = false;
  private busy = false;
  private page = 0;
  private content: Phaser.GameObjects.GameObject[] = [];

  constructor() { super('ShopScene'); }

  init(data: ShopLaunchData): void {
    this.tutorial = data.tutorial === true || TutorialProgressService.getMenuStep() === 'shop';
    this.busy = false;
    this.page = 0;
  }

  create(): void {
    AudioService.prepare(this);
    if (this.tutorial && PlayerProgressService.current.unlockedSpecialPaths.length > 0) {
      TutorialProgressService.setMenuStep('settings');
      this.scene.start('StartScene');
      return;
    }
    this.render();
  }

  private render(statusMessage = ''): void {
    this.content.forEach((object) => object.destroy());
    this.content = [];
    const { width, height } = this.scale;
    const compact = height < 560;
    const progress = PlayerProgressService.current;
    const sky = this.add.image(width / 2, height / 2, 'sky').setDisplaySize(width, height);
    const hills = this.add.image(width / 2, height, 'hills').setOrigin(.5, 1).setDisplaySize(width, height);
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x06100d, .8);
    this.content.push(sky, hills, shade);

    const panelWidth = Math.min(1040, width - 34);
    const panelHeight = Math.min(680, height - 28);
    const left = width / 2 - panelWidth / 2;
    const top = height / 2 - panelHeight / 2;
    const panel = this.add.graphics()
      .fillStyle(0x101d18, .98).fillRoundedRect(left, top, panelWidth, panelHeight, 18)
      .lineStyle(1, 0x607a68, .8).strokeRoundedRect(left, top, panelWidth, panelHeight, 18);
    this.content.push(panel);

    const back = this.add.text(left + 20, top + 20, '← 시작 화면', {
      fontFamily: 'Pretendard, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#dbe5d7',
      backgroundColor: '#1c2c25', padding: { x: 11, y: 7 },
    }).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('StartScene'));
    this.content.push(back);

    const title = this.add.text(width / 2, top + 34, '스페셜 유닛 구매', {
      fontFamily: 'Pretendard, sans-serif', fontSize: compact ? '22px' : '28px', fontStyle: 'bold', color: '#f0f3e4',
    }).setOrigin(.5);
    const subtitle = this.add.text(width / 2, top + (compact ? 59 : 70), '해금한 병종은 스페셜 유닛으로 사용할 수 있습니다.', {
      fontFamily: 'Pretendard, sans-serif', fontSize: compact ? '10px' : '12px', color: '#9fb0a3',
    }).setOrigin(.5);

    const gemRight = left + panelWidth - 20;
    const gemBackground = this.add.rectangle(gemRight - 45, top + 27, 90, 32, 0x142735, .9)
      .setStrokeStyle(1, 0x4b8196, .7);
    const gemIcon = this.add.text(gemRight - 69, top + 27, '💎', {
      fontFamily: 'Apple Color Emoji, sans-serif', fontSize: '15px',
    }).setOrigin(.5);
    const gemAmount = this.add.text(gemRight - 51, top + 24, `${progress.gold}`, {
      fontFamily: 'Pretendard, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#9ee8ff',
    }).setOrigin(0, .5);
    this.content.push(title, subtitle, gemBackground, gemIcon, gemAmount);

    const columns = width < 760 ? 1 : width >= 1180 ? 3 : 2;
    const rows = width < 760 || compact ? 1 : 2;
    const pageSize = columns * rows;
    const pageCount = Math.max(1, Math.ceil(SHOP_CATALOG.length / pageSize));
    this.page = Phaser.Math.Clamp(this.page, 0, pageCount - 1);
    const entries = SHOP_CATALOG.slice(this.page * pageSize, (this.page + 1) * pageSize);
    const availableWidth = panelWidth - 54;
    const availableHeight = panelHeight - (compact ? 132 : 164);
    const gap = 18;
    const cardSize = Math.min(
      compact ? 245 : 260,
      (availableHeight - gap * (rows - 1)) / rows,
      (availableWidth - gap * (columns - 1)) / columns,
    );
    const gridWidth = columns * cardSize + gap * (columns - 1);
    const gridHeight = rows * cardSize + gap * (rows - 1);
    const firstX = width / 2 - gridWidth / 2 + cardSize / 2;
    const firstY = top + (compact ? 83 : 101) + Math.max(0, (availableHeight - gridHeight) / 2) + cardSize / 2;
    entries.forEach((entry, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      this.createUnitCard(firstX + column * (cardSize + gap), firstY + row * (cardSize + gap), cardSize, entry);
    });

    const hint = this.add.text(width / 2, top + panelHeight - 25, statusMessage || '카드를 터치하여 상세 정보 보기', {
      fontFamily: 'Pretendard, sans-serif', fontSize: '11px', color: statusMessage ? '#aee7bd' : '#82958a',
    }).setOrigin(.5);
    this.content.push(hint);
    if (pageCount > 1) this.createPagination(width / 2, top + panelHeight - 50, pageCount);
    this.input.keyboard?.once('keydown-ESC', () => this.scene.start('StartScene'));
  }

  private createUnitCard(x: number, y: number, size: number, entry: ShopCatalogEntry): void {
    const { unit, path } = entry;
    const unlocked = PlayerProgressService.current.unlockedSpecialPaths.includes(path);
    const affordable = PlayerProgressService.current.gold >= SPECIAL_UNLOCK_COST[path];
    const card = this.add.rectangle(x, y, size, size, unlocked ? 0x1e3329 : 0x18251f, 1)
      .setStrokeStyle(1, unlocked ? 0x82b989 : 0x50645a)
      .setInteractive({ useHandCursor: true });
    const portrait = this.add.sprite(x, y - size * .08, unit).setFrame(0).setScale(size < 260 ? .36 : .46);
    const priceY = y + size / 2 - 30;
    const purchaseButton = this.add.rectangle(x, priceY, size - 24, 42,
      unlocked ? 0x294437 : affordable ? 0x294d5f : 0x303a35)
      .setStrokeStyle(1, unlocked ? 0x76a77c : 0x609db4);
    const priceAmount = this.add.text(x - 31, priceY - 3, unlocked ? '' : `${SPECIAL_UNLOCK_COST[path]}`, {
      fontFamily: 'Pretendard, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#b9e9f7',
    }).setOrigin(1, .5);
    const priceUnit = this.add.text(unlocked ? x : x - 26, priceY, unlocked ? '해금 완료' : '보석  ·  구매', {
      fontFamily: 'Pretendard, sans-serif', fontSize: '11px', color: '#91a8ad',
    }).setOrigin(unlocked ? .5 : 0, .5);
    if (!unlocked) {
      purchaseButton.setInteractive({ useHandCursor: true });
      purchaseButton.on('pointerover', () => purchaseButton.setFillStyle(affordable ? 0x37687f : 0x3b4740))
        .on('pointerout', () => purchaseButton.setFillStyle(affordable ? 0x294d5f : 0x303a35))
        .on('pointerdown', () => void this.unlockPath(path, unit));
    }
    card.on('pointerover', () => card.setStrokeStyle(2, 0x9ad1b0).setScale(1.015));
    card.on('pointerout', () => card.setStrokeStyle(1, unlocked ? 0x82b989 : 0x50645a).setScale(1));
    card.on('pointerdown', () => this.scene.start('CodexScene', { unit, returnScene: 'ShopScene' }));
    this.content.push(card, portrait, purchaseButton, priceAmount, priceUnit);
  }

  private createPagination(x: number, y: number, pageCount: number): void {
    const label = this.add.text(x, y, `${this.page + 1} / ${pageCount}`, {
      fontFamily: 'monospace', fontSize: '11px', color: '#b9c7b9',
    }).setOrigin(.5);
    const previous = this.add.text(x - 58, y, '‹', { fontFamily: 'sans-serif', fontSize: '25px', color: '#dfe9c3' })
      .setOrigin(.5).setInteractive({ useHandCursor: true });
    const next = this.add.text(x + 58, y, '›', { fontFamily: 'sans-serif', fontSize: '25px', color: '#dfe9c3' })
      .setOrigin(.5).setInteractive({ useHandCursor: true });
    previous.setAlpha(this.page > 0 ? 1 : .3);
    next.setAlpha(this.page < pageCount - 1 ? 1 : .3);
    previous.on('pointerdown', () => { if (this.page > 0) { this.page -= 1; this.render(); } });
    next.on('pointerdown', () => { if (this.page < pageCount - 1) { this.page += 1; this.render(); } });
    this.content.push(label, previous, next);
  }

  private async unlockPath(path: SpecialPath, displayUnit: UnitKind = path): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await PlayerProgressService.purchaseSpecial(path);
      if (this.tutorial) {
        TutorialProgressService.setMenuStep('settings');
        this.scene.start('StartScene');
        return;
      }
      this.render(`${UNITS[displayUnit].name} 계열을 해금했습니다.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.render(message || '해금 처리에 실패했습니다.');
    } finally {
      this.busy = false;
    }
  }
}
