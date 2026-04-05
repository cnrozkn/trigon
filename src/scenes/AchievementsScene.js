import * as Phaser from 'phaser';

export default class AchievementsScene extends Phaser.Scene {
  constructor() {
    super({ key: 'AchievementsScene' });
  }

  create() {
    const { width, height } = this.scale;
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a12, 1);
    bg.fillRect(0, 0, width, height);

    this.add.text(width / 2, height * 0.1, 'ACHIEVEMENTS', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '32px',
      color: '#00ffcc',
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.5, '(Coming Soon)', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    const backBtn = this.add.text(width / 2, height * 0.85, 'BACK TO MENU', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    backBtn.on('pointerdown', () => {
      this.scene.start('Menu');
    });
  }
}
