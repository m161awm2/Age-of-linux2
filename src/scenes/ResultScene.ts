import Phaser from 'phaser';
import { DIFFICULTIES } from '../data/constants';
import type { GameResultData } from '../data/types';
import { RankService } from '../services/RankService';
import { AuthService } from '../services/AuthService';

export class ResultScene extends Phaser.Scene {
  private result!: GameResultData;
  private submitting = false;
  constructor() { super('ResultScene'); }
  init(data: GameResultData): void { this.result = data; }

  create(): void {
    const { width, height } = this.scale;
    this.add.image(width / 2, height / 2, 'sky').setDisplaySize(width, height);
    this.add.image(width / 2, height, 'hills').setOrigin(.5, 1).setDisplaySize(width, height);
    this.add.rectangle(width / 2, height / 2, width, height, this.result.victory ? 0x123c27 : 0x3b1515, .72);
    this.add.text(width / 2, height * .3, this.result.victory ? '승리' : '패배', {
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', fontSize: '78px', fontStyle: 'bold',
      color: this.result.victory ? '#dff28b' : '#ff9c83', stroke: '#181b13', strokeThickness: 9,
    }).setOrigin(.5);
    const minutes = Math.floor(this.result.elapsedSeconds / 60);
    const seconds = Math.floor(this.result.elapsedSeconds % 60).toString().padStart(2, '0');
    this.add.text(width / 2, height * .46, `${DIFFICULTIES[this.result.difficulty].label} · 전투 시간 ${minutes}:${seconds}`, {
      fontFamily: 'Pretendard, sans-serif', fontSize: '22px', color: '#f8efd5',
    }).setOrigin(.5);
    const actionsY = this.result.victory ? height * .72 : height * .62;
    this.createButton(width / 2 - 105, actionsY, '다시 전투', () => this.scene.start('GameScene', { difficulty: this.result.difficulty }));
    this.createButton(width / 2 + 105, actionsY, '시작 화면', () => this.scene.start('StartScene'));
    if (this.result.victory) this.createRankSubmission(width / 2, height * .59);
    this.input.keyboard?.on('keydown-R', () => this.scene.start('GameScene', { difficulty: this.result.difficulty }));
  }

  private createRankSubmission(x: number, y: number): void {
    const status = this.add.text(x, y, '', {
      fontFamily: 'Pretendard, sans-serif', fontSize: '15px', color: '#e9e4bd', align: 'center',
    }).setOrigin(.5);
    if (!this.result.rankedRunId) {
      status.setText('랭킹 서버에 연결되지 않아 이번 기록은 등록할 수 없습니다.').setColor('#e7b29d');
      return;
    }

    status.setText('로그인 아이디로 랭킹 기록을 자동 등록하는 중…');
    void AuthService.getLoginId().then((loginId) => {
      if (!loginId) throw new Error('로그인 아이디를 확인할 수 없습니다.');
      return this.submitRank(loginId, status);
    }).catch((error) => {
      console.warn('자동 랭킹 등록 실패', error);
      status.setText('랭킹 자동 등록에 실패했습니다.').setColor('#ffb09c');
    });
  }

  private async submitRank(nickname: string, status: Phaser.GameObjects.Text): Promise<void> {
    if (this.submitting || !this.result.rankedRunId) return;
    this.submitting = true;
    status.setText(`${nickname} 이름으로 기록을 등록하는 중…`).setColor('#e9e4bd');
    try {
      const result = await RankService.finishRun(this.result.rankedRunId, nickname, this.result.unitComposition);
      const message = result.personal_best ? '개인 최고 기록이 랭킹에 등록되었습니다!' : '전투 기록이 확인되었습니다. 기존 최고 기록을 유지합니다.';
      status.setText(message).setColor(result.personal_best ? '#dff28b' : '#d5cfaa');
    } catch (error) {
      console.warn('랭킹 기록 등록 실패', error);
      status.setText('기록 등록에 실패했습니다. 잠시 후 다시 시도해 주세요.').setColor('#ffb09c');
      this.submitting = false;
    }
  }

  private createButton(x: number, y: number, label: string, action: () => void): Phaser.GameObjects.GameObject[] {
    const button = this.add.rectangle(x, y, 185, 62, 0x294838).setStrokeStyle(2, 0xbcd277).setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y, label, { fontFamily: 'Pretendard, sans-serif', fontSize: '20px', fontStyle: 'bold', color: '#fff5d2' }).setOrigin(.5);
    button.on('pointerover', () => button.setScale(1.04)).on('pointerout', () => button.setScale(1)).on('pointerdown', action);
    return [button, text];
  }
}
