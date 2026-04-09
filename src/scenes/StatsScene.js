import * as Phaser from 'phaser';
import { loadGameProfile } from '../utils/Storage.js';
import { ACHIEVEMENTS } from '../systems/AchievementSystem.js';
import { getSafeAreaInsets } from '../platform/viewport.js';

export default class StatsScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StatsScene' });
  }

  create() {
    const menu = this.scene.get('Menu');
    if (menu) menu.setUIVisible(false);

    this._build();
    this.scale.on('resize', () => this._build());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (menu) menu.setUIVisible(true);
      this.scale.off('resize');
    });
  }

  _build() {
    this.children.removeAll(true);
    const { width, height } = this.scale;
    const insets = getSafeAreaInsets();
    const safeTop = Math.max(insets.top + 16, height * 0.08);
    const safeBot = Math.max(insets.bottom + 16, height * 0.06);

    // Dark Overlay Background
    const bg = this.add.graphics();
    bg.fillStyle(0x07090f, 0.94);
    bg.fillRect(0, 0, width, height);
    
    // Click catcher
    this.add.zone(width/2, height/2, width, height).setInteractive();

    // Header
    this.add.text(width / 2, safeTop + 24, 'CAREER STATS', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#00ffcc',
    }).setOrigin(0.5).setDepth(20).setStroke('#ff00aa', 2).setShadow(0, 0, 15, '#00ffff', true, true);

    // Back button
    const backH = 48;
    const backY = height - safeBot - backH;
    
    this.createMenuButton(width / 2, backY + backH / 2, '← BACK', () => {
      const audio = this.registry.get('audio');
      if (audio) audio.playUpgradeSelect();
      this.scene.stop();
    }, 0x00ffcc);

    // Content area
    const contentTop = safeTop + 85;
    const profile = loadGameProfile();

    this._buildStats(profile, width, contentTop);
  }

  createMenuButton(x, y, text, onClick, strokeColor = 0x4a90e2) {
    const btn = this.add.container(x, y).setDepth(60);
    const bg = this.add.graphics();
    const btnW = 180;
    const btnH = 48;

    const draw = (hover) => {
      bg.clear();
      bg.fillStyle(0x0f182b, hover ? 0.95 : 0.85);
      bg.lineStyle(2, strokeColor, hover ? 1 : 0.8);
      bg.fillRoundedRect(-btnW/2, -btnH/2, btnW, btnH, 10);
      bg.strokeRoundedRect(-btnW/2, -btnH/2, btnW, btnH, 10);
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

  _buildStats(profile, width, top) {
    const padX = Math.min(width * 0.08, 40);
    const fs = (fixed, _factor) => fixed + 'px';

    // ── Section: General ────────────────────────────────
    let y = top;
    y = this._section('GENERAL', width, padX, y, fs);

    const totalTimeMin = Math.floor((profile.totalPlayTimeMs || 0) / 60000);
    const timeStr = totalTimeMin >= 60
      ? `${Math.floor(totalTimeMin / 60)}h ${totalTimeMin % 60}m`
      : `${totalTimeMin}m`;

    const generalStats = [
      { label: 'Runs Played',   value: profile.totalGamesPlayed || 0 },
      { label: 'Total Play Time', value: timeStr },
      { label: 'High Score',    value: (profile.highScore || 0).toLocaleString() },
      { label: 'Best Level',    value: profile.bestLevel || 1 },
      { label: 'Total Coins Earned', value: (profile.coins || 0).toLocaleString() },
    ];
    y = this._rows(generalStats, width, padX, y, fs);

    // ── Section: Combat ──────────────────────────────────
    y += 15;
    y = this._section('COMBAT', width, padX, y, fs);

    const combatStats = [
      { label: 'Total Kills',     value: (profile.totalKills || 0).toLocaleString() },
      { label: 'Avg Kills/Run',   value: profile.totalGamesPlayed > 0 ? Math.round((profile.totalKills || 0) / profile.totalGamesPlayed) : 0 },
      { label: 'Total Boss Kills', value: profile.totalBossKills || 0 },
    ];
    y = this._rows(combatStats, width, padX, y, fs);

    // ── Section: Achievements ────────────────────────────
    y += 15;
    y = this._section('ACHIEVEMENTS', width, padX, y, fs);

    const unlockedCount = (profile.achievements || []).length;
    const total = ACHIEVEMENTS.length;

    const achStats = [
      { label: 'Unlocked',        value: `${unlockedCount} / ${total}` },
      { label: 'Rewards Claimed', value: (profile.claimedAchievementRewards || []).length },
    ];
    y = this._rows(achStats, width, padX, y, fs);
  }

  _section(title, width, padX, y, fs) {
    const sectionH = 30;
    const secBg = this.add.graphics().setDepth(5);
    secBg.fillStyle(0x1a2a44, 0.4);
    secBg.lineStyle(1, 0x00ffcc, 0.3);
    secBg.fillRoundedRect(padX, y, width - padX * 2, sectionH, 4);
    secBg.strokeRoundedRect(padX, y, width - padX * 2, sectionH, 4);

    this.add.text(padX + 12, y + sectionH / 2, title, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#00ffcc',
    }).setOrigin(0, 0.5).setDepth(6);

    return y + sectionH + 2;
  }

  _rows(stats, width, padX, y, fs) {
    const rowH = 36;
    stats.forEach((stat, i) => {
      const rowBg = this.add.graphics().setDepth(5);
      rowBg.fillStyle(0x0f182b, 0.6);
      rowBg.fillRoundedRect(padX, y, width - padX * 2, rowH, 2);

      this.add.text(padX + 14, y + rowH / 2, stat.label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#8ab0cc',
      }).setOrigin(0, 0.5).setDepth(6);

      this.add.text(width - padX - 14, y + rowH / 2, String(stat.value), {
        fontFamily: 'ui-monospace, monospace',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#ffffff',
      }).setOrigin(1, 0.5).setDepth(6);

      y += rowH + 2;
    });
    return y;
  }

  update(_time, delta) {
    if (this.bgShape) this.bgShape.rotation += (delta / 1000) * 0.1;
    if (this.bgGlow) this.bgGlow.alpha = 0.04 + (Math.sin(this.time.now * 0.001) + 1) * 0.02;
  }
}
