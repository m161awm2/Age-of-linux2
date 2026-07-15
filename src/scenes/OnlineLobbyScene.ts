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
    const panel = new OnlineLobbyPanel(() => this.scene.start('StartScene'));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => panel.destroy());
    this.input.keyboard?.once('keydown-ESC', () => void panel.exit());
  }
}
