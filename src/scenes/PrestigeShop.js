import * as Phaser from 'phaser';
import { loadGameProfile, saveGameProfile } from '../utils/Storage.js';

const UPGRADES = [
  { id: 'baseDamage', name: 'Base Damage', desc: '+1 Starting Damage', maxLvl: 5, baseCost: 500, costMult: 1.5 },
  { id: 'baseSpeed', name: 'Fire Rate', desc: 'Faster starting fire rate', maxLvl: 4, baseCost: 400, costMult: 1.5 },
  { id: 'coinMultiplier', name: 'Coin Bonus', desc: '+25% Coins per run', maxLvl: 4, baseCost: 1000, costMult: 1.8 },
  { id: 'baseShield', name: 'Starting Shield', desc: 'Start with extra shield', maxLvl: 2, baseCost: 1500, costMult: 2.5 },
  { id: 'extraReroll', name: 'Extra Rerolls', desc: '+1 Draft Re-roll', maxLvl: 3, baseCost: 1000, costMult: 2.0 },
  { id: 'nearMissRange', name: 'Graze Radius', desc: 'Easier Combos', maxLvl: 3, baseCost: 800, costMult: 1.6 },
];

export default class PrestigeShop extends Phaser.Scene {
  constructor() {
    super({ key: 'PrestigeShop' });
  }

  create() {
    const { width, height } = this.scale;
    this.profile = loadGameProfile();
    this.audio = this.registry.get('audio') || null;

    const bg = this.add.graphics();
    bg.fillStyle(0x0a0f16, 1);
    bg.fillRect(0, 0, width, height);

    this.add.text(width / 2, 40, 'PRESTIGE SHOP', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '32px',
      fontWeight: 'bold',
      color: '#ffd700',
    }).setOrigin(0.5);

    this.coinsText = this.add.text(width / 2, 80, `Coins: ${Math.floor(this.profile.coins)}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
      color: '#e6f1ff',
    }).setOrigin(0.5);

    this.rowsContainer = this.add.container(0, 140);
    this.drawList(width);

    const backBtn = this.add.text(width / 2, height - 50, 'BACK TO MENU', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    backBtn.on('pointerdown', () => {
      if (this.audio) this.audio.playUpgradeSelect();
      this.scene.start('Menu');
    });
  }

  drawList(width) {
    this.rowsContainer.removeAll(true);
    let y = 0;

    UPGRADES.forEach((upg) => {
      const currentLevel = this.profile.upgrades?.[upg.id] || 0;
      const isMax = currentLevel >= upg.maxLvl;
      const cost = isMax ? 0 : Math.floor(upg.baseCost * Math.pow(upg.costMult, currentLevel));

      const row = this.add.container(width / 2, y);

      const bg = this.add.graphics();
      bg.fillStyle(0x131c2e, 0.8);
      bg.lineStyle(2, isMax ? 0x64b5f6 : 0x4a90e2, 0.6);
      bg.fillRoundedRect(-160, -35, 320, 70, 10);
      bg.strokeRoundedRect(-160, -35, 320, 70, 10);

      const title = this.add.text(-140, -18, `${upg.name} (${currentLevel}/${upg.maxLvl})`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        fontWeight: 'bold',
        color: isMax ? '#aaeebb' : '#ffffff',
      });

      const desc = this.add.text(-140, 6, upg.desc, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#aaaaaa',
      });

      const btnBg = this.add.graphics();
      const btnColor = isMax ? 0x555555 : (this.profile.coins >= cost ? 0x22aa55 : 0xcc4444);
      btnBg.fillStyle(btnColor, 1);
      btnBg.fillRoundedRect(70, -18, 80, 36, 6);

      const btnZone = this.add.zone(110, 0, 80, 40).setInteractive({ useHandCursor: !isMax });

      const btnText = this.add.text(110, 0, isMax ? 'MAX' : `${cost} C`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        fontWeight: 'bold',
        color: '#ffffff',
      }).setOrigin(0.5);

      if (!isMax) {
        btnZone.on('pointerdown', () => {
          if (this.profile.coins >= cost) {
            this.profile.coins -= cost;
            if (!this.profile.upgrades) this.profile.upgrades = {};
            this.profile.upgrades[upg.id] = currentLevel + 1;
            saveGameProfile(this.profile);
            if (this.audio) this.audio.playLevelUp?.();
            this.coinsText.setText(`Coins: ${Math.floor(this.profile.coins)}`);
            this.drawList(width);
          } else {
            // Cannot afford
            this.tweens.add({
              targets: btnText,
              x: 110 + 4,
              duration: 50,
              yoyo: true,
              repeat: 2,
            });
          }
        });
      }

      row.add([bg, title, desc, btnBg, btnText, btnZone]);
      this.rowsContainer.add(row);
      y += 82;
    });
  }
}
