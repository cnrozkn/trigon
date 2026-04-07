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

const COSMETICS = [
  { id: 'default', name: 'Neon Blue', type: 'color', value: 0x88ffff, cost: 0 },
  { id: 'pink', name: 'Electric Pink', type: 'color', value: 0xff66cc, cost: 100 },
  { id: 'lime', name: 'Lime Green', type: 'color', value: 0x66ff66, cost: 100 },
  { id: 'gold', name: 'Solar Gold', type: 'color', value: 0xffd700, cost: 500 },
];

const SHIPS = [
  { id: 'striker', name: 'Striker', desc: 'Standard tactical unit.', cost: 0, color: 0x00ffcc },
  { id: 'heavy', name: 'Titan', desc: '+1 DMG, +1 Shield, -15% SPD.', cost: 1500, color: 0xff44aa },
  { id: 'ghost', name: 'Ghost', desc: 'Deployed with 2 units.', cost: 2000, color: 0xaaccff },
  { id: 'glitch', name: 'Glitch', desc: 'Erratic bullets, fast fever.', cost: 2500, color: 0xffeeaa },
];

export default class PrestigeShop extends Phaser.Scene {
  constructor() {
    super({ key: 'PrestigeShop' });
    this.activeTab = 'upgrades'; // 'upgrades' or 'cosmetics'
  }

  create() {
    const { width, height } = this.scale;
    this.profile = loadGameProfile();
    this.audio = this.registry.get('audio') || null;

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0f16, 0x0a0f16, 0x141b26, 0x141b26, 1);
    bg.fillRect(0, 0, width, height);

    this.add.text(width / 2, 40, 'PRESTIGE SHOP', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '28px',
      fontWeight: 'bold',
      color: '#ffd700',
    }).setOrigin(0.5).setDepth(20);

    this.coinsText = this.add.text(width / 2, 75, `Coins: ${this.profile.coins}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      color: '#e6f1ff',
    }).setOrigin(0.5).setDepth(20);

    // Tabs
    const tabY = 130;
    this.tabUpgradeBtn = this.add.text(width * 0.22, tabY, 'UPGRADES', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      fontWeight: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(20);

    this.tabCosmeticBtn = this.add.text(width * 0.5, tabY, 'COLORS', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      fontWeight: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(20);

    this.tabShipsBtn = this.add.text(width * 0.78, tabY, 'SHIPS', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      fontWeight: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(20);

    this.tabUpgradeBtn.on('pointerdown', () => {
      this.activeTab = 'upgrades';
      this.updateTabs();
      this.drawList(width);
    });

    this.tabCosmeticBtn.on('pointerdown', () => {
      this.activeTab = 'cosmetics';
      this.updateTabs();
      this.drawList(width);
    });

    this.tabShipsBtn.on('pointerdown', () => {
      this.activeTab = 'ships';
      this.updateTabs();
      this.drawList(width);
    });

    this.updateTabs();

    this.rowsContainer = this.add.container(0, 195);
    this.drawList(width);

    const backBtn = this.add.container(width / 2, height - 60);
    const btnBg = this.add.graphics();
    btnBg.fillStyle(0xffffff, 0.05);
    btnBg.fillRoundedRect(-100, -25, 200, 50, 25);
    btnBg.lineStyle(2, 0xffffff, 0.3);
    btnBg.strokeRoundedRect(-100, -25, 200, 50, 25);
    backBtn.add(btnBg);

    const btnText = this.add.text(0, 0, 'MENU', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      fontWeight: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);
    backBtn.add(btnText);

    backBtn.setInteractive(new Phaser.Geom.Rectangle(-100, -25, 200, 50), Phaser.Geom.Rectangle.Contains);
    backBtn.on('pointerdown', () => {
      if (this.audio) this.audio.playUpgradeSelect();
      this.scene.start('Menu');
    });

    backBtn.on('pointerover', () => {
      btnBg.clear();
      btnBg.fillStyle(0xffffff, 0.15);
      btnBg.fillRoundedRect(-100, -25, 200, 50, 25);
      btnBg.lineStyle(2, 0xffffff, 0.8);
      btnBg.strokeRoundedRect(-100, -25, 200, 50, 25);
    });

    backBtn.on('pointerout', () => {
      btnBg.clear();
      btnBg.fillStyle(0xffffff, 0.05);
      btnBg.fillRoundedRect(-100, -25, 200, 50, 25);
      btnBg.lineStyle(2, 0xffffff, 0.3);
      btnBg.strokeRoundedRect(-100, -25, 200, 50, 25);
    });
  }

  updateTabs() {
    const activeColor = '#00ffcc';
    const inactiveColor = '#667788';
    this.tabUpgradeBtn.setColor(this.activeTab === 'upgrades' ? activeColor : inactiveColor);
    this.tabCosmeticBtn.setColor(this.activeTab === 'cosmetics' ? activeColor : inactiveColor);
    this.tabShipsBtn.setColor(this.activeTab === 'ships' ? activeColor : inactiveColor);
  }

  drawList(width) {
    this.rowsContainer.removeAll(true);
    let y = 0;

    if (this.activeTab === 'upgrades') {
      UPGRADES.forEach((upg) => {
        const currentLevel = this.profile.upgrades?.[upg.id] || 0;
        const isMax = currentLevel >= upg.maxLvl;
        const cost = isMax ? 0 : Math.floor(upg.baseCost * Math.pow(upg.costMult, currentLevel));
        const row = this.createRow(width, y, upg.name, upg.desc, currentLevel, upg.maxLvl, cost, isMax, () => {
          if (this.profile.coins >= cost) {
            this.profile.coins -= cost;
            if (!this.profile.upgrades) this.profile.upgrades = {};
            this.profile.upgrades[upg.id] = currentLevel + 1;
            saveGameProfile(this.profile);
            this.audio?.playLevelUp?.();
            this.coinsText.setText(`Coins: ${this.profile.coins}`);
            this.drawList(width);
          }
        });
        this.rowsContainer.add(row);
        y += 90;
      });
    } else if (this.activeTab === 'cosmetics') {
      COSMETICS.forEach((item) => {
        const ownedCosmetics = this.profile.ownedCosmetics || ['default'];
        const isOwned = ownedCosmetics.includes(item.id);
        const isActive = this.profile.cosmetics?.playerColor === item.id || 
                         (item.id === 'default' && (!this.profile.cosmetics?.playerColor || this.profile.cosmetics?.playerColor === 'default'));
        
        const row = this.createRow(width, y, item.name, 'Gemi rengini değiştirir.', isOwned ? 1 : 0, 1, item.cost, false, () => {
          if (isOwned) {
            if (!this.profile.cosmetics) this.profile.cosmetics = {};
            this.profile.cosmetics.playerColor = item.id;
            saveGameProfile(this.profile);
            this.drawList(width);
          } else if (this.profile.coins >= item.cost) {
            this.profile.coins -= item.cost;
            if (!this.profile.ownedCosmetics) this.profile.ownedCosmetics = ['default'];
            this.profile.ownedCosmetics.push(item.id);
            saveGameProfile(this.profile);
            this.audio?.playLevelUp?.();
            this.coinsText.setText(`Coins: ${this.profile.coins}`);
            this.drawList(width);
          }
        }, isOwned, isActive, item.value);
        this.rowsContainer.add(row);
        y += 90;
      });
    } else if (this.activeTab === 'ships') {
      SHIPS.forEach((ship) => {
        const ownedShips = this.profile.ownedShips || ['striker'];
        const isOwned = ownedShips.includes(ship.id);
        const isActive = this.profile.selectedShip === ship.id;

        const row = this.createRow(width, y, ship.name, ship.desc, isOwned ? 1 : 0, 1, ship.cost, false, () => {
          if (isOwned) {
            this.profile.selectedShip = ship.id;
            saveGameProfile(this.profile);
            this.drawList(width);
          } else if (this.profile.coins >= ship.cost) {
            this.profile.coins -= ship.cost;
            if (!this.profile.ownedShips) this.profile.ownedShips = ['striker'];
            this.profile.ownedShips.push(ship.id);
            saveGameProfile(this.profile);
            this.audio?.playLevelUp?.();
            this.coinsText.setText(`Coins: ${this.profile.coins}`);
            this.drawList(width);
          }
        }, isOwned, isActive, ship.id === 'striker' ? 0xffffff : ship.color);
        this.rowsContainer.add(row);
        y += 90;
      });
    }
  }

  createRow(width, y, name, desc, currentLvl, maxLvl, cost, isMax, onClick, isOwned = false, isActive = false, colorPreview = null) {
    const row = this.add.container(width / 2, y);
    const bg = this.add.graphics();
    bg.fillStyle(0x131c2e, 0.85);
    bg.lineStyle(2, isActive ? 0x00ffcc : 0x4a90e2, 0.5);
    bg.fillRoundedRect(-160, -39, 320, 78, 10);
    bg.strokeRoundedRect(-160, -39, 320, 78, 10);

    let titleStr = name;
    if (this.activeTab === 'upgrades') titleStr += ` (${currentLvl}/${maxLvl})`;
    else if (isActive) titleStr += ' [ACTIVE]';

    const title = this.add.text(-142, -24, titleStr, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '17px',
      fontWeight: 'bold',
      color: isMax ? '#aaeebb' : (isActive ? '#00ffcc' : '#ffffff'),
    });

    const description = this.add.text(-142, 6, desc, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#999999',
      wordWrap: { width: 200 }
    });

    if (colorPreview !== null) {
      const p = this.add.graphics();
      p.fillStyle(colorPreview, 1);
      p.fillTriangle(-148, -12, -158, 2, -138, 2); // Small ship icon
      row.add(p);
      title.setX(-132);
      description.setX(-132);
    }

    const btnBg = this.add.graphics();
    let btnLabel = isMax ? 'MAX' : `${cost} C`;
    if (this.activeTab === 'cosmetics' || this.activeTab === 'ships') {
      if (isActive) btnLabel = 'ACTIVE';
      else if (isOwned) btnLabel = 'SELECT';
    }

    const canAfford = this.profile.coins >= cost || isOwned;
    const btnColor = isMax || (isActive && this.activeTab === 'cosmetics') ? 0x444444 : (canAfford ? 0x22aa55 : 0xcc4444);
    
    btnBg.fillStyle(btnColor, 1);
    btnBg.fillRoundedRect(65, -18, 90, 36, 6);

    const btnZone = this.add.zone(110, 0, 90, 40).setInteractive({ useHandCursor: !isMax && !isActive });
    const btnText = this.add.text(110, 0, btnLabel, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      fontWeight: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    if (!isMax && !isActive) {
      btnZone.on('pointerdown', onClick);
    }

    row.add([bg, title, description, btnBg, btnText, btnZone]);
    return row;
  }
}
