import Phaser from 'phaser';
import './style.css';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { ResultScene } from './scenes/ResultScene';
import { StartScene } from './scenes/StartScene';
import { CodexScene } from './scenes/CodexScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#0d1815',
  width: window.innerWidth,
  height: window.innerHeight,
  pixelArt: false,
  antialias: true,
  render: { roundPixels: true, powerPreference: 'high-performance' },
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH, min: { width: 720, height: 480 } },
  scene: [BootScene, StartScene, CodexScene, GameScene, ResultScene],
  input: { mouse: { preventDefaultWheel: true }, touch: { capture: true } },
};

new Phaser.Game(config);
