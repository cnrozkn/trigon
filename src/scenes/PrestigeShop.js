import * as Phaser from 'phaser';
import { loadGameProfile, saveGameProfile } from '../utils/Storage.js';
import { getSafeAreaInsets } from '../platform/viewport.js';

const UPGRADES = [
  { id: 'baseDamage',    name: 'Base Damage',      desc: '+1 starting damage per level',       maxLvl: 5, baseCost: 500,  costMult: 1.5 },
  { id: 'baseSpeed',     name: 'Fire Rate',         desc: 'Faster starting auto-fire',          maxLvl: 4, baseCost: 400,  costMult: 1.5 },
  { id: 'coinMultiplier',name: 'Coin Bonus',        desc: '+25% coins earned per run',          maxLvl: 4, baseCost: 1000, costMult: 1.8 },
  { id: 'baseShield',    name: 'Starting Shield',   desc: 'Begin each run with extra shield',   maxLvl: 2, baseCost: 1500, costMult: 2.5 },
  { id: 'extraReroll',   name: 'Extra Rerolls',     desc: '+1 draft re-roll per level-up',      maxLvl: 3, baseCost: 1000, costMult: 2.0 },
  { id: 'nearMissRange', name: 'Graze Radius',      desc: 'Wider near-miss window for combos',  maxLvl: 3, baseCost: 800,  costMult: 1.6 },
  { id: 'bulletSpeed',   name: 'Bullet Velocity',   desc: '+15% bullet speed per level',        maxLvl: 3, baseCost: 600,  costMult: 1.6 },
  { id: 'formationGap',  name: 'Formation Spread',  desc: 'Tighter ship formation spacing',     maxLvl: 2, baseCost: 700,  costMult: 2.0 },
];

const COSMETICS = [
  { id: 'default', name: 'Neon Blue',     desc: 'Default tactical colour',     color: 0x00ffcc, cost: 0    },
  { id: 'pink',    name: 'Electric Pink', desc: 'Hot-pink energy signature',   color: 0xff66cc, cost: 100  },
  { id: 'lime',    name: 'Lime Strike',   desc: 'High-vis lime green hull',    color: 0x66ff66, cost: 100  },
  { id: 'gold',    name: 'Solar Gold',    desc: 'Rare solar-forge alloy',      color: 0xffd700, cost: 500  },
  { id: 'purple',  name: 'Void Purple',   desc: 'Deep-space void pigment',     color: 0xcc44ff, cost: 300  },
  { id: 'orange',  name: 'Nova Flare',    desc: 'Supernova burst finish',      color: 0xff8800, cost: 300  },
  { id: 'white',   name: 'Ghost White',   desc: 'Stealth matte-white coating', color: 0xffffff, cost: 200  },
];

const SHIPS = [
  { id: 'striker', name: 'Striker', desc: 'Standard tactical unit',               cost: 0,    color: 0x00ffcc },
  { id: 'heavy',   name: 'Titan',   desc: '+1 DMG  ·  +1 Shield  ·  −15% SPD',   cost: 1500, color: 0xff44aa },
  { id: 'ghost',   name: 'Ghost',   desc: 'Deployed with 2 formation units',      cost: 2000, color: 0xaaccff },
  { id: 'glitch',  name: 'Glitch',  desc: 'Erratic bullets · fever charges fast', cost: 2500, color: 0xffeeaa },
];

export default class PrestigeShop extends Phaser.Scene {
  constructor() {
    super({ key: 'PrestigeShop' });
    this.activeTab = 'upgrades';
    this._scrollY = 0;
  }

  create() {
    const menu = this.scene.get('Menu');
    if (menu) menu.setUIVisible(false);

    this._build();
    this.scale.on('resize', () => { this._scrollY = 0; this._build(); });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (menu) menu.setUIVisible(true);
      this.scale.off('resize');
      this.input.off('wheel');
    });
  }

  _build() {
    this.children.removeAll(true);
    const { width, height } = this.scale;

    this.profile = loadGameProfile();
    this.audio   = this.registry.get('audio') || null;

    // Dark Overlay Background
    const bg = this.add.graphics();
    bg.fillStyle(0x07090f, 0.92); // Slightly higher opacity to help focus
    bg.fillRect(0, 0, width, height);
    
    // Add click-catcher
    this.add.zone(width/2, height/2, width, height).setInteractive();

    // Header Area
    const safeTop = Math.max(getSafeAreaInsets().top + 16, height * 0.05);
    const headerH = 70;
    
    this.add.text(width / 2, safeTop + 24, 'PRESTIGE SHOP', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#00ffcc',
    }).setOrigin(0.5).setDepth(20).setStroke('#ff00aa', 3).setShadow(0, 0, 20, '#00ffff', true, true);

    this.coinsText = this.add.text(width / 2, safeTop + 58, `Coins: ${Math.floor(this.profile.coins || 0)}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      color: '#ffd700',
    }).setOrigin(0.5).setDepth(20).setStroke('#000000', 4);

    // Tabs
    const tabY = safeTop + headerH + 28;
    const tabH = 34;
    const tabs = [
      { key: 'upgrades',  label: 'UPGRADES' },
      { key: 'cosmetics', label: 'COLORS'   },
      { key: 'ships',     label: 'SHIPS'    },
    ];
    const tabW = Math.min(width * 0.94, 440);
    const tabStartX = (width - tabW) / 2;
    const itemW = tabW / tabs.length;

    this._tabBtns = tabs.map(({ key, label }, i) => {
      const x = tabStartX + itemW * i + itemW / 2;
      const btn = this.add.text(x, tabY + tabH / 2, label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(20).setInteractive({ useHandCursor: true });

      const tabUnderline = this.add.graphics().setDepth(19);
      btn.underline = tabUnderline;

      btn.on('pointerdown', () => {
        if (this.audio) this.audio.playUpgradeSelect();
        this.activeTab = key;
        this._scrollY  = 0;
        this._refreshTabs(tabStartX, itemW, tabY, tabH);
        this._refreshList(width, listTop);
      });

      return { key, btn };
    });
    this._refreshTabs(tabStartX, itemW, tabY, tabH);

    // Back button — account for home indicator / safe area
    const safeBot = Math.max(getSafeAreaInsets().bottom + 16, height * 0.06);
    const backH = 48;
    const backY = height - safeBot - backH;
    
    this.createMenuButton(width / 2, backY + backH / 2, '← BACK', () => {
      if (this.audio) this.audio.playUpgradeSelect();
      this.scene.stop();
    }, 0x00ffcc);

    // Scrollable list
    const listTop    = tabY + tabH + 30;
    const listBottom = backY - 30;
    this._listTop = listTop;
    this._maskH   = listBottom - listTop;

    const maskShape = this.make.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(0, listTop, width, this._maskH);
    const mask = maskShape.createGeometryMask();

    this.rowsContainer = this.add.container(0, 0).setDepth(5).setMask(mask);

    const scrollZone = this.add.zone(0, listTop, width, this._maskH)
      .setOrigin(0).setInteractive({ draggable: true }).setDepth(4);
    scrollZone.on('dragstart', (_p, _x, y) => { this._dragStartY = y; });
    scrollZone.on('drag', (_p, _x, y) => {
      this._applyScroll(this._scrollY + (y - this._dragStartY) * 1.6);
      this._dragStartY = y;
    });

    this.input.off('wheel');
    this.input.on('wheel', (_p, _gx, _gy, _dx, dy) => {
      this._applyScroll(this._scrollY - dy * 0.5);
    });

    this._refreshList(width, listTop);
  }

  createMenuButton(x, y, text, onClick, strokeColor = 0x4a90e2) {
    const btn = this.add.container(x, y).setDepth(60);
    const bg = this.add.graphics();
    const btnW = 180;
    const btnH = 48; // iOS minimum touch target 44pt
    
    const draw = (hover) => {
      bg.clear();
      bg.fillStyle(0x0f182b, hover ? 0.95 : 0.85);
      bg.lineStyle(2, strokeColor, hover ? 1 : 0.8);
      bg.fillRoundedRect(-btnW/2, -btnH/2, btnW, btnH, 10);
      bg.strokeRoundedRect(-btnW/2, -btnH/2, btnW, btnH, 10);
      if (hover) {
        bg.lineStyle(4, strokeColor, 0.3);
        bg.strokeRoundedRect(-btnW/2 - 2, -btnH/2 - 2, btnW + 4, btnH + 4, 12);
      }
    };
    draw(false);

    const txt = this.add.text(0, 0, text, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#e6f1ff',
    }).setOrigin(0.5);

    btn.add([bg, txt]);

    const zone = this.add.zone(0, 0, btnW, btnH).setInteractive({ useHandCursor: true });
    btn.add(zone);

    zone.on('pointerdown', onClick);
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => draw(false));
  }

  _refreshTabs(tabStartX, itemW, tabY, tabH) {
    this._tabBtns.forEach(({ key, btn }) => {
      const active = key === this.activeTab;
      btn.setColor(active ? '#00ffcc' : '#667788');
      btn.setShadow(0, 0, active ? 10 : 0, '#00ffcc', true, true);
      
      btn.underline.clear();
      if (active) {
        btn.underline.lineStyle(2, 0x00ffcc, 1);
        btn.underline.lineBetween(btn.x - 20, tabY + tabH, btn.x + 20, tabY + tabH);
      }
    });
  }

  _refreshList(width, listTop) {
    this.rowsContainer.removeAll(true);
    this.rowsContainer.y = 0;

    const cx   = width / 2;
    const rowW = Math.min(340, width * 0.92);
    const rowH = 82;
    const gap  = 12;
    let y = listTop + 5;

    if (this.activeTab === 'upgrades') {
      UPGRADES.forEach((upg) => {
        const currentLevel = this.profile.upgrades?.[upg.id] || 0;
        const isMax = currentLevel >= upg.maxLvl;
        const cost  = isMax ? 0 : Math.floor(upg.baseCost * Math.pow(upg.costMult, currentLevel));
        this._addRow(cx, y, rowW, rowH, `${upg.name} (${currentLevel}/${upg.maxLvl})`, upg.desc, cost, isMax, false, false, null, () => {
          if (!isMax && this.profile.coins >= cost) {
            this.profile.coins -= cost;
            if (!this.profile.upgrades) this.profile.upgrades = {};
            this.profile.upgrades[upg.id] = currentLevel + 1;
            saveGameProfile(this.profile);
            this.audio?.playLevelUp?.();
            this.coinsText.setText(`Coins: ${Math.floor(this.profile.coins)}`);
            this._refreshList(width, listTop);
          }
        });
        y += rowH + gap;
      });
    } else if (this.activeTab === 'cosmetics') {
      COSMETICS.forEach((item) => {
        const ownedCosmetics = this.profile.ownedCosmetics || ['default'];
        const isOwned = ownedCosmetics.includes(item.id);
        const isActive = this.profile.cosmetics?.playerColor === item.id ||
          (item.id === 'default' && (!this.profile.cosmetics?.playerColor || this.profile.cosmetics?.playerColor === 'default'));
        this._addRow(cx, y, rowW, rowH, item.name, item.desc, item.cost, false, isOwned, isActive, item.color, () => {
          if (isOwned) {
            if (!this.profile.cosmetics) this.profile.cosmetics = {};
            this.profile.cosmetics.playerColor = item.id;
            saveGameProfile(this.profile);
            this._refreshList(width, listTop);
          } else if (this.profile.coins >= item.cost) {
            this.profile.coins -= item.cost;
            if (!this.profile.ownedCosmetics) this.profile.ownedCosmetics = ['default'];
            this.profile.ownedCosmetics.push(item.id);
            saveGameProfile(this.profile);
            this.audio?.playLevelUp?.();
            this.coinsText.setText(`Coins: ${Math.floor(this.profile.coins)}`);
            this._refreshList(width, listTop);
          }
        });
        y += rowH + gap;
      });
    } else if (this.activeTab === 'ships') {
      SHIPS.forEach((ship) => {
        const ownedShips = this.profile.ownedShips || ['striker'];
        const isOwned  = ownedShips.includes(ship.id);
        const isActive = this.profile.selectedShip === ship.id ||
          (ship.id === 'striker' && !this.profile.selectedShip);
        this._addRow(cx, y, rowW, rowH, ship.name, ship.desc, ship.cost, false, isOwned, isActive, ship.color, () => {
          if (isOwned) {
            this.profile.selectedShip = ship.id;
            saveGameProfile(this.profile);
            this._refreshList(width, listTop);
          } else if (this.profile.coins >= ship.cost) {
            this.profile.coins -= ship.cost;
            if (!this.profile.ownedShips) this.profile.ownedShips = ['striker'];
            this.profile.ownedShips.push(ship.id);
            saveGameProfile(this.profile);
            this.audio?.playLevelUp?.();
            this.coinsText.setText(`Coins: ${Math.floor(this.profile.coins)}`);
            this._refreshList(width, listTop);
          }
        });
        y += rowH + gap;
      });
    }

    this._totalListH = y - listTop;
    this._applyScroll(this._scrollY);
  }

  _addRow(cx, y, rowW, rowH, name, desc, cost, isMax, isOwned, isActive, colorPreview, onClick) {
    const x = cx - rowW / 2;

    const bgGfx = this.add.graphics();
    const drawBg = (hover) => {
      bgGfx.clear();
      bgGfx.fillStyle(0x0f182b, hover ? 0.95 : 0.8);
      bgGfx.lineStyle(2, isActive ? 0x00ffcc : 0x2a4060, isActive ? 1 : 0.6);
      bgGfx.fillRoundedRect(x, y, rowW, rowH, 12);
      bgGfx.strokeRoundedRect(x, y, rowW, rowH, 12);
      if (isActive) {
        bgGfx.lineStyle(4, 0x00ffcc, 0.2);
        bgGfx.strokeRoundedRect(x - 2, y - 2, rowW + 4, rowH + 4, 14);
      }
    };
    drawBg(false);
    this.rowsContainer.add(bgGfx);

    let textX = x + 20;
    if (colorPreview !== null) {
      const p = this.add.graphics();
      p.fillStyle(colorPreview, 1);
      const px = x + 28;
      const py = y + rowH / 2;
      p.fillCircle(px, py, 12);
      p.lineStyle(2, 0xffffff, 0.5);
      p.strokeCircle(px, py, 12);
      this.rowsContainer.add(p);
      textX = x + 54;
    }

    const nameColor = isMax ? '#aaeebb' : (isActive ? '#00ffcc' : '#ffffff');
    const nameTxt = this.add.text(textX, y + 18, name, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: nameColor,
    }).setOrigin(0, 0);
    this.rowsContainer.add(nameTxt);

    const descTxt = this.add.text(textX, y + 46, desc, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#8ab0cc',
      wordWrap: { width: rowW - (textX - x) - 110 },
    }).setOrigin(0, 0);
    this.rowsContainer.add(descTxt);

    // Button
    const btnW = 90;
    const btnH = 36;
    const btnX = x + rowW - btnW - 14;
    const btnY = y + (rowH - btnH) / 2;

    let btnLabel = isMax ? 'MAX' : `${cost} C`;
    if (this.activeTab !== 'upgrades') {
      if (isActive) btnLabel = 'ACTIVE';
      else if (isOwned) btnLabel = 'SELECT';
    }

    const canAfford  = this.profile.coins >= cost || isOwned;
    const isDisabled = isMax || isActive;
    
    const btnGfx = this.add.graphics();
    const drawBtn = (hover) => {
      btnGfx.clear();
      let color = 0x2a4060;
      if (!isDisabled) {
        if (isOwned || (this.activeTab === 'upgrades' && !isMax)) {
          color = canAfford ? 0x00ffcc : 0xff3366;
        } else {
          color = canAfford ? 0x00ffcc : 0xff3366;
        }
      }
      
      btnGfx.fillStyle(color, hover ? 1 : 0.8);
      btnGfx.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      if (!isDisabled && canAfford) {
        btnGfx.lineStyle(2, 0xffffff, 0.3);
        btnGfx.strokeRoundedRect(btnX, btnY, btnW, btnH, 8);
      }
    };
    drawBtn(false);
    this.rowsContainer.add(btnGfx);

    const btnTxt = this.add.text(btnX + btnW / 2, btnY + btnH / 2, btnLabel, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);
    this.rowsContainer.add(btnTxt);

    if (!isDisabled) {
      const btnZone = this.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
        .setInteractive({ useHandCursor: true });
      btnZone.on('pointerover', () => { drawBtn(true); drawBg(true); });
      btnZone.on('pointerout',  () => { drawBtn(false); drawBg(false); });
      btnZone.on('pointerdown', onClick);
      this.rowsContainer.add(btnZone);
    }
  }

  _applyScroll(targetY) {
    const maxScroll = Math.max(0, this._totalListH - this._maskH);
    this._scrollY = Phaser.Math.Clamp(targetY, -maxScroll, 0);
    this.rowsContainer.y = this._scrollY;
  }

  update(_time, delta) {
    if (this.bgShape) this.bgShape.rotation += (delta / 1000) * 0.12;
    if (this.bgGlow) this.bgGlow.alpha = 0.04 + (Math.sin(this.time.now * 0.001) + 1) * 0.02;
  }
}
