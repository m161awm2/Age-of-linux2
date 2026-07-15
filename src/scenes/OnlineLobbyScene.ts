import Phaser from 'phaser';
import { AudioService } from '../services/AudioService';
import { OnlineLobbyPanel } from '../ui/OnlineLobbyPanel';

export class OnlineLobbyScene extends Phaser.Scene {
  constructor() { super('OnlineLobbyScene'); }

  create(): void {
    const { width, height } = this.scale;
    AudioService.prepare(this);
    this.add.image(width / 2, height / 2, 'sky').setDisplaySize(width, height);
    this.add.image(width / 2, height, 'hills').setOrigin(.5, 1).setDisplaySize(width, height);
    this.add.image(width / 2, height, 'ground').setOrigin(.5, 1).setDisplaySize(width, height);
    this.add.rectangle(width / 2, height / 2, width, height, 0x06100d, .7);
    const panel = new OnlineLobbyPanel(
      () => this.scene.start('StartScene'),
      (room) => this.scene.start('GameScene', {
        difficulty: 'Medium',
        pvp: {
          roomId: room.id,
          isHost: room.is_host,
          hostUserId: room.host_user_id,
          guestUserId: room.guest_user_id!,
          opponentLoginId: room.is_host ? room.guest_login_id ?? '상대' : room.host_login_id,
        },
      }),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => panel.destroy());
    this.input.keyboard?.once('keydown-ESC', () => void panel.exit());
  }
}
