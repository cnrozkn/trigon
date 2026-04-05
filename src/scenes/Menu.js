import * as Phaser from 'phaser';
import { loadGameProfile } from '../utils/Storage.js';

export default class Menu extends Phaser.Scene {
  constructor() {
    super({ key: 'Menu' });
  }

  layoutMenu(width, height) {
    if (!this.titleText || !this.subText || !this.hintText) return;
    if (this.bgShape) this.bgShape.setPosition(width / 2, height * 0.52);
    if (this.bgGlow) this.bgGlow.setPosition(width / 2, height * 0.52).setSize(width * 0.92, width * 0.92);
    if (this.tapStartZone) this.tapStartZone.setPosition(width / 2, height * 0.3).setSize(width, height * 0.5);
    this.titleText.setPosition(width / 2, height * 0.22);
    this.subText.setPosition(width / 2, height * 0.32);
    if (this.metaText) this.metaText.setPosition(width / 2, height * 0.12);
    
    // buttons layout
    this.hintText.setPosition(width / 2, height * 0.55);
    if (this.buttonsContainer) {
      this.buttonsContainer.setPosition(width / 2, height * 0.75);
    }
  }

  createBackdrop(width, height) {
    this.bgGlow = this.add.ellipse(width / 2, height * 0.52, width * 0.92, width * 0.92, 0x3f2a72, 0.07).setDepth(1);
    this.bgShape = this.add.graphics().setPosition(width / 2, height * 0.52).setDepth(2);
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
      .text(width / 2, height * 0.28, 'TRIGON', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '52px',
        fontStyle: 'bold',
        color: '#00ffcc',
      })
      .setOrigin(0.5)
      .setStroke('#ff00aa', 4)
      .setShadow(0, 0, 20, '#00ffff', true, true);

    this.subText = this.add
      .text(width / 2, height * 0.42, 'Neon Bullet Hell', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#ccaaff',
      })
      .setOrigin(0.5);

    this.hintText = this.add
      .text(width / 2, height * 0.55, 'Tap to Play', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '32px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(60)
      .setInteractive({ useHandCursor: true });

    // Above menu visuals so touches always hit a defined interactive target on mobile.
    this.tapStartZone = this.add
      .zone(width / 2, height * 0.3, width, height * 0.5)
      .setOrigin(0.5)
      .setDepth(100)
      .setInteractive({ useHandCursor: false });

    this.tapStartZone.once('pointerdown', (_pointer, _lx, _ly, evt) => {
      if (evt?.stopPropagation) evt.stopPropagation();
      this.ensureAudioUnlocked();
      void this.startGameFromMenu();
    });
    this.hintText.once('pointerdown', (_pointer, _lx, _ly, evt) => {
      if (evt?.stopPropagation) evt.stopPropagation();
      this.ensureAudioUnlocked();
      void this.startGameFromMenu();
    });

    this.metaText = this.add
      .text(
        width / 2,
        height * 0.12,
        `Coins: ${Math.floor(profile.coins || 0)}  |  Best: ${profile.highScore}`,
        {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '18px',
          color: '#ffd700',
        },
      )
      .setOrigin(0.5);

    this.buttonsContainer = this.add.container(width / 2, height * 0.75).setDepth(60);
    this.createMenuButton(0, -30, 'Shop & Upgrades', () => this.scene.start('PrestigeShop'));
    this.createMenuButton(0, 30, 'Achievements', () => this.scene.start('AchievementsScene'));

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

  createMenuButton(x, y, text, onClick) {
    const btn = this.add.container(x, y);
    const bg = this.add.graphics();
    bg.fillStyle(0x0f182b, 0.85);
    bg.lineStyle(2, 0x4a90e2, 0.8);
    bg.fillRoundedRect(-110, -22, 220, 44, 12);
    bg.strokeRoundedRect(-110, -22, 220, 44, 12);

    const txt = this.add.text(0, 0, text, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      color: '#e6f1ff',
    }).setOrigin(0.5);

    btn.add([bg, txt]);

    const zone = this.add.zone(0, 0, 220, 44).setInteractive({ useHandCursor: true });
    btn.add(zone);

    zone.on('pointerdown', () => {
      this.ensureAudioUnlocked();
      if (this.audio) this.audio.playUpgradeSelect();
      onClick();
    });
    
    zone.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x192a4a, 0.95);
      bg.lineStyle(2, 0x64b5f6, 1);
      bg.fillRoundedRect(-110, -22, 220, 44, 12);
      bg.strokeRoundedRect(-110, -22, 220, 44, 12);
    });

    zone.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x0f182b, 0.85);
      bg.lineStyle(2, 0x4a90e2, 0.8);
      bg.fillRoundedRect(-110, -22, 220, 44, 12);
      bg.strokeRoundedRect(-110, -22, 220, 44, 12);
    });

    this.buttonsContainer.add(btn);
  }

  async startGameFromMenu() {
    if (this.hasStarted) return;
    this.hasStarted = true;

    if (this.audio) {
      this.audio.playUpgradeSelect();
    }
    if (this.scene.isActive('Menu')) this.scene.start('PlayScene');
  }

  update(_time, delta) {
    if (this.bgShape) this.bgShape.rotation += (delta / 1000) * 0.16;
    if (this.bgGlow) this.bgGlow.alpha = 0.05 + (Math.sin(this.time.now * 0.001) + 1) * 0.02;
  }
}
