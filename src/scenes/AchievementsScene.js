import * as Phaser from 'phaser';
import { loadGameProfile } from '../utils/Storage';
import { ACHIEVEMENTS } from '../systems/AchievementSystem';

export default class AchievementsScene extends Phaser.Scene {
  constructor() {
    super({ key: 'AchievementsScene' });
  }

  create() {
    const { width, height } = this.scale;
    const profile = loadGameProfile();
    const unlockedIds = new Set(profile.achievements || []);

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0f111a, 0x0f111a, 0x1a1d2e, 0x1a1d2e, 1);
    bg.fillRect(0, 0, width, height);

    this.add.text(width / 2, height * 0.08, 'ACHIEVEMENTS', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#00ffcc',
    }).setOrigin(0.5);

    const container = this.add.container(width * 0.1, height * 0.18);
    const itemWidth = width * 0.8;
    const itemHeight = 70;

    ACHIEVEMENTS.forEach((ach, index) => {
      const isUnlocked = unlockedIds.has(ach.id);
      const y = index * (itemHeight + 12);
      
      const itemBg = this.add.graphics();
      itemBg.fillStyle(isUnlocked ? 0x1e2235 : 0x11131e, 0.85);
      itemBg.fillRoundedRect(0, y, itemWidth, itemHeight, 8);
      if (isUnlocked) {
        itemBg.lineStyle(2, 0x00ffcc, 0.4);
        itemBg.strokeRoundedRect(0, y, itemWidth, itemHeight, 8);
      }
      container.add(itemBg);

      const icon = this.add.text(15, y + itemHeight / 2, isUnlocked ? ach.icon : '🔒', {
        fontSize: '28px'
      }).setOrigin(0, 0.5);
      container.add(icon);

      const name = this.add.text(60, y + 15, ach.name, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: isUnlocked ? '#ffffff' : '#555555',
      }).setOrigin(0, 0);
      container.add(name);

      const desc = this.add.text(60, y + 40, ach.desc, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: isUnlocked ? '#aaaaaa' : '#444444',
      }).setOrigin(0, 0);
      container.add(desc);

      if (isUnlocked) {
        const checkMark = this.add.text(itemWidth - 20, y + itemHeight / 2, '✓', {
          fontSize: '20px',
          color: '#00ffcc'
        }).setOrigin(1, 0.5);
        container.add(checkMark);
      }
    });

    const backBtn = this.add.container(width / 2, height * 0.9);
    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x00ffcc, 0.1);
    btnBg.fillRoundedRect(-100, -25, 200, 50, 25);
    btnBg.lineStyle(2, 0x00ffcc, 1);
    btnBg.strokeRoundedRect(-100, -25, 200, 50, 25);
    backBtn.add(btnBg);

    const btnText = this.add.text(0, 0, 'MENU', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#00ffcc',
    }).setOrigin(0.5);
    backBtn.add(btnText);

    backBtn.setInteractive(new Phaser.Geom.Rectangle(-100, -25, 200, 50), Phaser.Geom.Rectangle.Contains);
    backBtn.on('pointerdown', () => {
      this.scene.start('Menu');
    });

    backBtn.on('pointerover', () => {
      btnBg.clear();
      btnBg.fillStyle(0x00ffcc, 0.2);
      btnBg.fillRoundedRect(-100, -25, 200, 50, 25);
      btnBg.lineStyle(2, 0x00ffcc, 1);
      btnBg.strokeRoundedRect(-100, -25, 200, 50, 25);
    });

    backBtn.on('pointerout', () => {
      btnBg.clear();
      btnBg.fillStyle(0x00ffcc, 0.1);
      btnBg.fillRoundedRect(-100, -25, 200, 50, 25);
      btnBg.lineStyle(2, 0x00ffcc, 1);
      btnBg.strokeRoundedRect(-100, -25, 200, 50, 25);
    });
  }
}
