import Phaser from 'phaser';
import { AudioService } from '../services/AudioService';
import { AuthPanel } from '../ui/AuthPanel';

export class AuthScene extends Phaser.Scene {
  constructor() { super('AuthScene'); }

  create(): void {
    const { width, height } = this.scale;
    AudioService.prepare(this);
    this.add.image(width / 2, height / 2, 'sky').setDisplaySize(width, height);
    this.add.image(width / 2, height, 'hills').setOrigin(.5, 1).setDisplaySize(width, height);
    this.add.image(width / 2, height, 'ground').setOrigin(.5, 1).setDisplaySize(width, height);
    this.add.rectangle(width / 2, height / 2, width, height, 0x06100d, .68);
    const panel = new AuthPanel(() => this.scene.start('StartScene'));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => panel.destroy());
  }
}
