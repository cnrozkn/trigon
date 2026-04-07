import * as Phaser from 'phaser';
import { loadGameProfile } from '../utils/Storage.js';
import { getTodayChallenge, isChallengeAttempted } from '../systems/ChallengeSystem.js';

export default class Menu extends Phaser.Scene {
  constructor() {
    super({ key: 'Menu' });
  }

  layoutMenu(width, height) {
    if (!this.titleText || !this.subText || !this.hintText) return;
    if (this.bgShape) this.bgShape.setPosition(width / 2, height * 0.5);
    if (this.bgGlow) this.bgGlow.setPosition(width / 2, height * 0.5).setSize(width * 0.92, width * 0.92);
    if (this.tapStartZone) this.tapStartZone.setPosition(width / 2, height * 0.28).setSize(width, height * 0.45);
    this.titleText.setPosition(width / 2, height * 0.2);
    this.subText.setPosition(width / 2, height * 0.29);
    if (this.metaText) this.metaText.setPosition(width / 2, height * 0.1);
    
    this.hintText.setPosition(width / 2, height * 0.5);
    if (this.buttonsContainer) {
      this.buttonsContainer.setPosition(width / 2, height * 0.72);
    }
  }

  createBackdrop(width, height) {
    this.bgGlow = this.add.ellipse(width / 2, height * 0.5, width * 0.92, width * 0.92, 0x3f2a72, 0.07).setDepth(1);
    this.bgShape = this.add.graphics().setPosition(width / 2, height * 0.5).setDepth(2);
    this.bgShape.lineStyle(2, 0x88ccff, 0.28);
    this.bgShape.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = -Math.PI / 2 + ((i % 6) / 6) * Math.PI * 2;
      const x = Math.cos(a) * 130;
      const y = Math.sin(a) * 130;
      if (i === 0) this.bgShape.moveTo(x, y);
      else this.bgShape.lineTo(x, y);
    }
    this.bgShape.closePath();
    this.bgShape.strokePath();

    this.ambient = this.add.particles(0, 0, 'particle_dot', {
      x: { min: 0, max: width },
      y: { min: 0, max: height },
      speedY: { min: -12, max: 12 },
      speedX: { min: -10, max: 10 },
      scale: { start: 0.45, end: 0.1 },
      alpha: { start: 0.32, end: 0 },
      tint: [0x66ffff, 0xff66cc, 0xffffff],
      lifespan: 4200,
      quantity: 1,
      frequency: 170,
      blendMode: 'ADD',
    }).setDepth(0);
  }

  create() {
    const { width, height } = this.scale;
    this.createBackdrop(width, height);
    this.hasStarted = false;
    this.audio = this.registry.get('audio') || null;
    const profile = loadGameProfile();

    this.titleText = this.add
      .text(width / 2, height * 0.25, 'TRIGON', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '52px',
        fontStyle: 'bold',
        color: '#00ffcc',
      })
      .setOrigin(0.5)
      .setStroke('#ff00aa', 4)
      .setShadow(0, 0, 20, '#00ffff', true, true);

    this.subText = this.add
      .text(width / 2, height * 0.38, 'Neon Bullet Hell', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#ccaaff',
      })
      .setOrigin(0.5);

    this.hintText = this.add
      .text(width / 2, height * 0.52, 'Tap to Play', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '32px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(60)
      .setInteractive({ useHandCursor: true });

    this.tapStartZone = this.add
      .zone(width / 2, height * 0.28, width, height * 0.45)
      .setOrigin(0.5)
      .setDepth(100)
      .setInteractive({ useHandCursor: false });

    this.tapStartZone.once('pointerdown', (_p, _lx, _ly, evt) => {
      if (evt?.stopPropagation) evt.stopPropagation();
      this.ensureAudioUnlocked();
      void this.startGameFromMenu();
    });
    this.hintText.once('pointerdown', (_p, _lx, _ly, evt) => {
      if (evt?.stopPropagation) evt.stopPropagation();
      this.ensureAudioUnlocked();
      void this.startGameFromMenu();
    });

    this.metaText = this.add
      .text(
        width / 2,
        height * 0.1,
        `Coins: ${Math.floor(profile.coins || 0)}  |  Best: ${profile.highScore}`,
        {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '18px',
          color: '#ffd700',
        },
      )
      .setOrigin(0.5);

    this.buttonsContainer = this.add.container(width / 2, height * 0.72).setDepth(60);
    
    // Check daily challenge status
    const challengeDone = isChallengeAttempted(profile);
    const today = getTodayChallenge();

    this.createMenuButton(0, -66, 'Shop & Upgrades', () => this.scene.start('PrestigeShop'));
    this.createMenuButton(0, -14, 'Achievements', () => this.scene.start('AchievementsScene'));
    this.createMenuButton(0, 38, challengeDone ? 'Challenge (Done)' : `Daily: ${today.name}`, () => {
      this.scene.start('PlayScene', { challenge: today });
    }, challengeDone ? 0x667788 : 0xaa66ff);

    this.tweens.add({
      targets: this.hintText,
      alpha: 0.35,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });
    this.tweens.add({
      targets: this.hintText,
      scale: 1.06,
      duration: 760,
      yoyo: true,
      ease: 'Sine.easeInOut',
      repeat: -1,
    });

    this.onResize = (gameSize) => this.layoutMenu(gameSize.width, gameSize.height);
    this.scale.on('resize', this.onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.onResize);
      if (this.ambient) this.ambient.destroy();
      if (this.bgShape) this.bgShape.destroy();
      if (this.bgGlow) this.bgGlow.destroy();
      if (this.tapStartZone) this.tapStartZone.destroy();
    });
  }

  ensureAudioUnlocked() {
    if (this.audio && this.audio.unlockSyncFromUserGesture) {
      this.audio.unlockSyncFromUserGesture();
    }
  }

  createMenuButton(x, y, text, onClick, strokeColor = 0x4a90e2) {
    const btn = this.add.container(x, y);
    const bg = this.add.graphics();
    bg.fillStyle(0x0f182b, 0.85);
    bg.lineStyle(2, strokeColor, 0.8);
    bg.fillRoundedRect(-110, -20, 220, 40, 10);
    bg.strokeRoundedRect(-110, -20, 220, 40, 10);

    const txt = this.add.text(0, 0, text, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#e6f1ff',
    }).setOrigin(0.5);

    btn.add([bg, txt]);

    const zone = this.add.zone(0, 0, 220, 40).setInteractive({ useHandCursor: true });
    btn.add(zone);

    zone.on('pointerdown', () => {
      this.ensureAudioUnlocked();
      if (this.audio) this.audio.playUpgradeSelect();
      onClick();
    });
    
    zone.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x192a4a, 0.95);
      bg.lineStyle(2, strokeColor, 1);
      bg.fillRoundedRect(-110, -20, 220, 40, 10);
      bg.strokeRoundedRect(-110, -20, 220, 40, 10);
    });

    zone.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x0f182b, 0.85);
      bg.lineStyle(2, strokeColor, 0.8);
      bg.fillRoundedRect(-110, -20, 220, 40, 10);
      bg.strokeRoundedRect(-110, -20, 220, 40, 10);
    });

    this.buttonsContainer.add(btn);
  }

  async startGameFromMenu() {
    if (this.hasStarted) return;
    this.hasStarted = true;

    if (this.audio) {
      this.audio.playUpgradeSelect();
    }
    this.showClassSelection();
  }

  showClassSelection() {
    this.hintText.setVisible(false);
    this.buttonsContainer.setVisible(false);
    this.tapStartZone.disableInteractive();
    if (this.metaText) this.metaText.setVisible(false);
    if (this.subText) this.subText.setVisible(false);

    const { width, height } = this.scale;
    const classContainer = this.add.container(width / 2, height * 0.52).setDepth(150);
    const profile = loadGameProfile();
    const ownedShips = profile.ownedShips || ['striker'];

    const title = this.add.text(0, -180, 'Select Ship Model', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '28px',
      color: '#fff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    classContainer.add(title);

    const classes = [
      { id: 'striker', name: 'Striker', desc: 'Standard tactical unit.', color: 0x00ffcc },
      { id: 'heavy', name: 'Titan', desc: '+1 DMG, +1 Shield, Slow Fire', color: 0xff44aa },
      { id: 'ghost', name: 'Ghost', desc: 'Starts with 2 units', color: 0xaaccff },
      { id: 'glitch', name: 'Glitch', desc: 'Erratic bullets, fast fever', color: 0xffeeaa },
    ];

    classes.forEach((c, i) => {
      const y = -110 + i * 80;
      const isOwned = ownedShips.includes(c.id);
      
      const btnBg = this.add.graphics();
      btnBg.fillStyle(0x0a1022, isOwned ? 0.9 : 0.4);
      btnBg.lineStyle(2, c.color, isOwned ? 0.8 : 0.2);
      btnBg.fillRoundedRect(-140, y, 280, 68, 8);
      btnBg.strokeRoundedRect(-140, y, 280, 68, 8);

      const nameTxt = this.add.text(-120, y + 14, c.name, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: isOwned ? '#fff' : '#666',
        fontStyle: 'bold'
      });

      const descTxt = this.add.text(-120, y + 38, isOwned ? c.desc : 'LOCKED - Buy in Shop', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: isOwned ? '#aaa' : '#444',
      });

      const zone = this.add.zone(0, y + 34, 280, 68).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
         if (this.audio) this.audio.playUpgradeSelect();
         if (isOwned) {
           this.scene.start('PlayScene', { shipClass: c.id });
         } else {
           this.scene.start('PrestigeShop');
         }
      });

      classContainer.add([btnBg, nameTxt, descTxt, zone]);
    });

    const backBtn = this.add.text(0, 220, '[ BACK TO MENU ]', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#446688',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    backBtn.on('pointerdown', () => {
      this.scene.restart();
    });
    classContainer.add(backBtn);
  }

  update(_time, delta) {
    if (this.bgShape) this.bgShape.rotation += (delta / 1000) * 0.16;
    if (this.bgGlow) this.bgGlow.alpha = 0.05 + (Math.sin(this.time.now * 0.001) + 1) * 0.02;
  }
}
