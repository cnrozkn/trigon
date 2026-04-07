import * as Phaser from 'phaser';
import { loadAudioSettings, saveAudioSettings } from '../utils/Storage.js';

export default class SettingsScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SettingsScene' });
  }

  init(data) {
    // 'fromScene' tells us where to go back: 'Menu' or 'UIScene' (pause)
    this.fromScene = data?.fromScene || 'Menu';
    this.isPauseContext = data?.isPauseContext || false;
  }

  create() {
    const menu = this.scene.get('Menu');
    if (menu) menu.setUIVisible(false);

    const { width, height } = this.scale;
    this.audio = this.registry.get('audio') || null;
    this.settings = this.audio ? this.audio.getSettings() : loadAudioSettings();

    // Dark overlay background
    this.add.rectangle(width * 0.5, height * 0.5, width, height, 0x07090f, 0.94);
    
    // Catch clicks
    this.add.zone(width/2, height/2, width, height).setInteractive();

    // Panel
    const panelW = Math.min(width * 0.92, 420);
    const panelH = Math.min(height * 0.72, 540);
    const panelX = (width - panelW) * 0.5;
    const panelY = (height - panelH) * 0.5;

    const panel = this.add.graphics();
    panel.fillStyle(0x0c1220, 0.95);
    panel.lineStyle(2, 0x00ffcc, 0.8);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 16);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 16);

    this.add.text(width * 0.5, panelY + 44, 'SETTINGS', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#00ffcc',
    }).setOrigin(0.5).setStroke('#ff00aa', 2).setShadow(0, 0, 10, '#00ffff', true, true);

    // Section label
    this.add.text(width * 0.5, panelY + 96, 'AUDIO', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#8ab0cc',
      letterSpacing: 2,
    }).setOrigin(0.5);

    const sliderStartY = panelY + 140;

    // Master Volume
    this.createSlider('Master', sliderStartY, this.settings.masterVolume ?? 0.9, (v) => {
      this.settings.masterVolume = v;
      if (this.audio) this.audio.setMasterVolume(v);
      this.saveSettings();
    });

    // SFX Volume
    this.createSlider('SFX', sliderStartY + 72, this.settings.sfxVolume ?? 0.85, (v) => {
      this.settings.sfxVolume = v;
      if (this.audio) this.audio.setSfxVolume(v);
      this.saveSettings();
    });

    // Mute Toggle
    this.muteBtn = this.createToggle(
      'Mute All',
      sliderStartY + 158,
      this.settings.muted,
      (v) => {
        this.settings.muted = v;
        if (this.audio) this.audio.setMuted(v);
        this.saveSettings();
      }
    );

    // Haptic Toggle
    this.hapticBtn = this.createToggle(
      'Haptic',
      sliderStartY + 218,
      this.settings.hapticEnabled !== false,
      (v) => {
        this.settings.hapticEnabled = v;
        this.saveSettings();
      }
    );

    // Back button
    const backY = panelY + panelH - 44;
    const backBtn = this.add.text(width * 0.5, backY, '← BACK', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#00ffcc',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    backBtn.on('pointerover', () => backBtn.setShadow(0,0,10,'#00ffcc',true,true));
    backBtn.on('pointerout', () => backBtn.setShadow(0,0,0));
    backBtn.on('pointerdown', () => this.goBack());

    this.scale.on('resize', this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (menu) menu.setUIVisible(true);
      this.scale.off('resize', this.handleResize, this);
    });
  }

  createSlider(label, y, initialValue, onChange) {
    const { width } = this.scale;
    const labelX = width * 0.5 - 120;
    const barX = width * 0.5 - 8;
    const barW = 160;
    const barH = 12;

    this.add.text(labelX, y, label, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#e6f1ff',
    }).setOrigin(0, 0.5);

    const bg = this.add
      .rectangle(barX, y, barW, barH, 0x1a2a40, 0.95)
      .setOrigin(0, 0.5)
      .setStrokeStyle(1, 0x4a90e2, 0.8)
      .setInteractive({ useHandCursor: true });

    const fill = this.add
      .rectangle(barX, y, Math.max(2, barW * Phaser.Math.Clamp(initialValue, 0, 1)), barH, 0x00ffcc, 1)
      .setOrigin(0, 0.5);

    const knob = this.add
      .circle(barX + barW * Phaser.Math.Clamp(initialValue, 0, 1), y, 10, 0xffffff, 1)
      .setStrokeStyle(2, 0x00ffcc, 1)
      .setInteractive({ useHandCursor: true, draggable: true });

    const pct = this.add.text(barX + barW + 14, y, `${Math.round(Phaser.Math.Clamp(initialValue, 0, 1) * 100)}`, {
      fontFamily: 'ui-monospace, monospace',
      fontSize: '13px',
      color: '#00ffcc',
    }).setOrigin(0, 0.5);

    const update = (worldX) => {
      const ratio = Phaser.Math.Clamp((worldX - barX) / barW, 0, 1);
      fill.width = Math.max(2, barW * ratio);
      knob.x = barX + barW * ratio;
      pct.setText(`${Math.round(ratio * 100)}`);
      onChange(ratio);
    };

    bg.on('pointerdown', (pointer) => update(pointer.worldX));
    knob.on('drag', (pointer) => update(pointer.worldX));
  }

  createToggle(label, y, initialValue, onChange) {
    const { width } = this.scale;
    let value = initialValue;

    this.add.text(width * 0.5 - 120, y, label, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#e6f1ff',
    }).setOrigin(0, 0.5);

    const toggleBg = this.add
      .rectangle(width * 0.5 + 90, y, 54, 26, value ? 0x00aa88 : 0x2a3a50, 1)
      .setStrokeStyle(1, 0x00ffcc, 0.8)
      .setInteractive({ useHandCursor: true });

    const toggleKnob = this.add
      .circle(width * 0.5 + 90 + (value ? 14 : -14), y, 10, 0xffffff, 1);

    const valueLabel = this.add.text(width * 0.5 - 8, y, value ? 'ON' : 'OFF', {
      fontFamily: 'ui-monospace, monospace',
      fontSize: '13px',
      color: value ? '#00ffcc' : '#8ab0cc',
    }).setOrigin(0.5);

    const toggle = () => {
      value = !value;
      toggleBg.setFillStyle(value ? 0x00aa88 : 0x2a3a50);
      toggleKnob.x = width * 0.5 + 90 + (value ? 14 : -14);
      valueLabel.setText(value ? 'ON' : 'OFF').setColor(value ? '#00ffcc' : '#8ab0cc');
      onChange(value);
    };

    toggleBg.on('pointerdown', toggle);
    toggleKnob.setInteractive({ useHandCursor: true }).on('pointerdown', toggle);

    return { toggleBg, toggleKnob, valueLabel };
  }

  saveSettings() {
    saveAudioSettings(this.settings);
  }

  goBack() {
    this.scene.stop();
  }

  handleResize() {
    // Restart scene to relayout — simple and safe since settings are persisted
    this.scene.restart({ fromScene: this.fromScene, isPauseContext: this.isPauseContext });
  }
}
