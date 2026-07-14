import Phaser from 'phaser';
import { DIFFICULTIES } from '../data/constants';
import { UNITS } from '../data/units';
import type { Difficulty } from '../data/types';
import { AudioService } from '../services/AudioService';
import { RankService, type LeaderboardEntry } from '../services/RankService';

const DIFFICULTY_COLORS: Record<Difficulty, number> = {
  Easy: 0x4fa56b,
  Medium: 0xd8ad3e,
  Hard: 0xc9554e,
};

export class RankScene extends Phaser.Scene {
  private difficulty: Difficulty = 'Easy';
  private page = 0;
  private entries: LeaderboardEntry[] = [];
  private contentObjects: Phaser.GameObjects.GameObject[] = [];
  private loading = false;

  constructor() { super('RankScene'); }

  create(): void {
    const { width, height } = this.scale;
    AudioService.prepare(this);
    this.add.image(width / 2, height / 2, 'sky').setDisplaySize(width, height);
    this.add.image(width / 2, height, 'hills').setOrigin(.5, 1).setDisplaySize(width, height);
    this.add.rectangle(width / 2, height / 2, width, height, 0x06100d, .78);
    this.add.graphics()
      .fillStyle(0x091711, .96).fillRoundedRect(22, 18, width - 44, height - 36, 20)
      .lineStyle(2, 0xb8a766, .8).strokeRoundedRect(22, 18, width - 44, height - 36, 20);
    this.add.text(width / 2, 47, '전투 랭킹', {
      fontFamily: 'Georgia, Pretendard, serif', fontSize: '30px', fontStyle: 'bold', color: '#f0dfa0',
      stroke: '#111b14', strokeThickness: 4,
    }).setOrigin(.5);
    this.createButton(76, 46, 92, 34, '← 메뉴', () => this.scene.start('StartScene'));
    this.createButton(width - 76, 46, 92, 34, '새로고침', () => void this.loadRanks());

    (['Easy', 'Medium', 'Hard'] as Difficulty[]).forEach((difficulty, index) => {
      const x = width / 2 + (index - 1) * 150;
      const background = this.add.rectangle(x, 96, 134, 38, 0x1d3027)
        .setStrokeStyle(2, DIFFICULTY_COLORS[difficulty]).setInteractive({ useHandCursor: true });
      const label = this.add.text(x, 96, DIFFICULTIES[difficulty].label, {
        fontFamily: 'Pretendard, sans-serif', fontSize: '16px', fontStyle: 'bold', color: '#fff5d8',
      }).setOrigin(.5);
      background.on('pointerdown', () => {
        this.difficulty = difficulty;
        this.page = 0;
        void this.loadRanks();
      });
      background.setData('difficulty', difficulty);
      label.setData('difficulty', difficulty);
    });

    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('StartScene'));
    void this.loadRanks();
  }

  private async loadRanks(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.renderMessage('랭킹을 불러오는 중…', '#d8d4b3');
    try {
      this.entries = await RankService.getLeaderboard(this.difficulty);
      this.renderTable();
    } catch (error) {
      console.warn('랭킹 조회 실패', error);
      this.renderMessage('랭킹 데이터베이스 준비가 필요하거나 연결할 수 없습니다.', '#ffb09c');
    } finally {
      this.loading = false;
    }
  }

  private renderTable(): void {
    this.clearContent();
    const { width, height } = this.scale;
    const compact = height < 620;
    const rowsPerPage = compact ? 7 : 10;
    const totalPages = Math.max(1, Math.ceil(this.entries.length / rowsPerPage));
    this.page = Phaser.Math.Clamp(this.page, 0, totalPages - 1);
    const visible = this.entries.slice(this.page * rowsPerPage, (this.page + 1) * rowsPerPage);
    const tableWidth = Math.min(760, width - 100);
    const left = width / 2 - tableWidth / 2;
    const top = compact ? 126 : 132;
    const rowHeight = compact ? 35 : 40;
    const header = this.add.rectangle(width / 2, top, tableWidth, 32, 0x263b30).setStrokeStyle(1, 0x7b8766);
    this.contentObjects.push(header);
    this.addTableText(left + 38, top, '순위', 12, '#dcd397');
    this.addTableText(left + tableWidth * .25, top, '닉네임', 12, '#dcd397');
    this.addTableText(left + tableWidth * .59, top, '사용 병종 조합', 12, '#dcd397');
    this.addTableText(left + tableWidth - 90, top, '전투 시간', 12, '#dcd397');

    if (visible.length === 0) {
      const empty = this.add.text(width / 2, top + 82, '아직 등록된 기록이 없습니다.\n첫 번째 승리자가 되어 보세요!', {
        fontFamily: 'Pretendard, sans-serif', fontSize: '17px', color: '#cdd2bd', align: 'center', lineSpacing: 8,
      }).setOrigin(.5);
      this.contentObjects.push(empty);
    }

    visible.forEach((entry, index) => {
      const y = top + 32 + rowHeight * index + rowHeight / 2;
      const bg = this.add.rectangle(width / 2, y, tableWidth, rowHeight - 2, entry.is_me ? 0x42512a : index % 2 ? 0x102018 : 0x15261d, .96);
      this.contentObjects.push(bg);
      const medal = entry.rank_position === 1 ? '🥇' : entry.rank_position === 2 ? '🥈' : entry.rank_position === 3 ? '🥉' : `${entry.rank_position}`;
      this.addTableText(left + 38, y, medal, 14, entry.is_me ? '#eff59a' : '#ede4c7');
      this.addTableText(left + tableWidth * .25, y, `${entry.nickname}${entry.is_me ? '  (나)' : ''}`, 14, entry.is_me ? '#eff59a' : '#f3eedb');
      this.addCompositionSprites(left + tableWidth * .59, y, entry.unit_composition, compact);
      this.addTableText(left + tableWidth - 90, y, this.formatTime(entry.best_time_ms), 14, '#d7e3ae');
    });

    const footerY = height - 48;
    if (this.page > 0) this.contentObjects.push(...this.createButton(112, footerY, 120, 36, '← 이전', () => { this.page--; this.renderTable(); }));
    const pageLabel = this.add.text(width / 2, footerY, `${this.page + 1} / ${totalPages}`, {
      fontFamily: 'monospace', fontSize: '13px', color: '#b9b181',
    }).setOrigin(.5);
    this.contentObjects.push(pageLabel);
    if (this.page < totalPages - 1) this.contentObjects.push(...this.createButton(width - 112, footerY, 120, 36, '다음 →', () => { this.page++; this.renderTable(); }));
  }

  private renderMessage(message: string, color: string): void {
    this.clearContent();
    const text = this.add.text(this.scale.width / 2, this.scale.height / 2, message, {
      fontFamily: 'Pretendard, sans-serif', fontSize: '17px', color, align: 'center',
      wordWrap: { width: this.scale.width - 160 },
    }).setOrigin(.5);
    this.contentObjects.push(text);
  }

  private addTableText(x: number, y: number, value: string, size: number, color: string): void {
    const text = this.add.text(x, y, value, {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: `${size}px`, fontStyle: 'bold', color,
    }).setOrigin(.5);
    this.contentObjects.push(text);
  }

  private clearContent(): void {
    this.contentObjects.forEach((object) => object.destroy());
    this.contentObjects = [];
  }

  private formatTime(milliseconds: number): string {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    const millis = milliseconds % 1000;
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  }

  private addCompositionSprites(x: number, y: number, composition: Record<string, number>, compact: boolean): void {
    const units = Object.entries(composition)
      .filter(([, count]) => Number(count) > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]));
    if (units.length === 0) {
      this.addTableText(x, y, '-', 12, '#d6d9c2');
      return;
    }
    const visible = units.slice(0, 3);
    const gap = compact ? 42 : 48;
    visible.forEach(([kind, count], index) => {
      const unit = UNITS[kind as keyof typeof UNITS];
      if (!unit) return;
      const spriteX = x + (index - (visible.length - 1) / 2) * gap;
      const sprite = this.add.sprite(spriteX, y, unit.texture, 0).setDisplaySize(compact ? 29 : 33, compact ? 29 : 33);
      sprite.play(`${unit.texture}-idle`);
      const badge = this.add.text(spriteX + (compact ? 12 : 14), y + 10, `×${count}`, {
        fontFamily: 'monospace', fontSize: compact ? '9px' : '10px', fontStyle: 'bold', color: '#fff4bd',
        backgroundColor: '#101912dd', padding: { x: 2, y: 1 },
      }).setOrigin(.5);
      this.contentObjects.push(sprite, badge);
    });
    if (units.length > 3) {
      const more = this.add.text(x + gap * 1.82, y, `+${units.length - 3}`, {
        fontFamily: 'monospace', fontSize: '10px', fontStyle: 'bold', color: '#bfc7ae',
      }).setOrigin(.5);
      this.contentObjects.push(more);
    }
  }

  private createButton(x: number, y: number, width: number, height: number, label: string, action: () => void): Phaser.GameObjects.GameObject[] {
    const background = this.add.rectangle(x, y, width, height, 0x263b30).setStrokeStyle(1, 0xa6a06d).setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y, label, {
      fontFamily: 'Pretendard, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#fff5d3',
    }).setOrigin(.5);
    background.on('pointerover', () => background.setFillStyle(0x385545)).on('pointerout', () => background.setFillStyle(0x263b30)).on('pointerdown', action);
    return [background, text];
  }
}
