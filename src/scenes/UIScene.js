import * as Phaser from 'phaser';

export default class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
  }

  create() {
    const { width, height } = this.scale;
    
    // UI Elements
    // Overdrive Bar (Now at the top since Level bar was removed)
    this.overdriveBarBg = this.add.graphics().setDepth(50);
    this.overdriveBarFill = this.add.graphics().setDepth(51);
    this.overdriveBarText = this.add.text(0, 0, 'OD', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        fontWeight: 'bold',
        color: '#00ffcc',
    }).setOrigin(0.5).setDepth(52).setVisible(false);

    this.powerupBarBg = this.add.graphics().setDepth(50);
    this.powerupBarFill = this.add.graphics().setDepth(51);

    this.hudScore = this.add.text(16, 18, 'Score: 0', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#aaffff',
    }).setOrigin(0, 0.5).setDepth(100);

    this.hudLevel = this.add.text(16, 18, 'LV.1', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ccddff',
    }).setOrigin(0, 0.5).setDepth(100);

    this.hudWave = this.add.text(16, 18, 'WAVE 0/0', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#9fd6ff',
    }).setOrigin(0, 0.5).setDepth(100);

    this.hudCombo = this.add.text(width * 0.5, 88, 'x0', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '34px',
        fontStyle: 'bold',
        color: '#ffe080',
    }).setOrigin(0.5).setDepth(110).setAlpha(0);

    this.hudFever = this.add.text(width * 0.5, 128, 'FEVER!', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '40px',
        fontStyle: 'bold',
        color: '#ff78ff',
    }).setOrigin(0.5).setDepth(112).setAlpha(0);

    this.pauseButton = this.add.text(width - 24, 24, '||', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#d7e8ff',
    }).setOrigin(1, 0.5).setDepth(120).setInteractive({ useHandCursor: true });

    this.pauseButton.on('pointerdown', () => {
       const playScene = this.scene.get('PlayScene');
       if (playScene) {
           playScene.togglePauseByUser();
       }
    });

    // Progress Bars
    // Handled above
    this.powerupBarText = this.add.text(0, 0, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#ffffff',
    }).setOrigin(0.5).setDepth(52);

    // Layout
    this.layoutTop();
    this.drawPowerupBar(0, '');

    // Listen to Global Game Events
    const playScene = this.scene.get('PlayScene');
    
    this.game.events.on('update_score', (score) => {
        this.hudScore.setText(`Score: ${Math.floor(score)}`);
        this.layoutTop();
    });

    this.game.events.on('update_level', (level) => {
        this.hudLevel.setText(`LV.${level}`);
        this.layoutTop();
    });

    this.game.events.on('update_wave', (current, total) => {
        if (total > 0) {
          this.hudWave.setText(`WAVE ${current}/${total}`);
        } else {
          this.hudWave.setText('');
        }
        this.layoutTop();
    });

    this.game.events.on('update_combo', (streak) => {
        if (streak > 1) {
            this.hudCombo.setText(`x${streak}`);
            this.hudCombo.setAlpha(1);
            this.hudCombo.setScale(1.3);
            this.tweens.killTweensOf(this.hudCombo);
            this.tweens.add({
                targets: this.hudCombo,
                scale: 1,
                alpha: { start: 1, to: 0.8 },
                duration: 300,
                ease: 'Back.out',
            });
        } else {
            this.tweens.killTweensOf(this.hudCombo);
            this.tweens.add({
                targets: this.hudCombo,
                alpha: 0,
                duration: 200,
            });
        }
    });

    this.game.events.on('fever_start', () => {
        this.hudFever.setAlpha(1).setScale(1.5);
        this.tweens.add({
            targets: this.hudFever,
            scale: 1,
            duration: 400,
            ease: 'Back.out',
        });
    });
    
    this.game.events.on('fever_end', () => {
        this.tweens.add({
            targets: this.hudFever,
            alpha: 0,
            duration: 500,
        });
    });

    this.game.events.on('update_overdrive', (charge, active) => {
        this.drawOverdrive(charge, active);
    });

    this.game.events.on('update_bars', (levelProgress, powerupProgress, powerupLabel) => {
        this.drawPowerupBar(powerupProgress, powerupLabel);
    });

    this.game.events.on('toggle_ui_visibility', (visible) => {
        this.pauseButton.setVisible(visible);
        this.progressBarBg.setVisible(visible);
        this.progressBarFill.setVisible(visible);
        this.hudScore.setVisible(visible);
        this.hudLevel.setVisible(visible);
        this.hudWave.setVisible(visible);
        this.overdriveBarBg.setVisible(visible);
        this.overdriveBarFill.setVisible(visible);
        this.overdriveBarText.setVisible(visible);
        this.overdriveBarText.setVisible(visible);
    });

    this.game.events.on('show_pause', (audioSettings) => {
        this.renderPauseOverlay(audioSettings);
    });

    this.game.events.on('hide_pause', () => {
         if (this.pauseOverlay) this.pauseOverlay.setVisible(false);
    });

    this.game.events.on('show_game_over', (result) => {
        this.renderGameOverOverlay(result);
    });

    this.game.events.on('show_onboarding', (stepData) => {
        this.renderOnboardingStep(stepData);
    });

    this.game.events.on('show_upgrade_selection', (data) => {
        this.renderUpgradeSelectionModal(data);
    });

    this.game.events.on('update_upgrade_selection', (data) => {
        this.renderUpgradeSelectionModal(data);
    });

    this.game.events.on('close_upgrade_selection', () => {
        if (this.upgradeOverlay) {
            this.upgradeOverlay.destroy(true);
            this.upgradeOverlay = null;
        }
    });

    this.game.events.on('hide_onboarding', () => {
        if (this.onboardingOverlay) {
            this.onboardingOverlay.destroy(true);
            this.onboardingOverlay = null;
        }
    });

    // Clean up events on destroy
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.game.events.off('update_score');
        this.game.events.off('update_level');
        this.game.events.off('update_wave');
        this.game.events.off('update_combo');
        this.game.events.off('fever_start');
        this.game.events.off('fever_end');
        this.game.events.off('update_overdrive');
        this.game.events.off('update_bars');
        this.game.events.off('toggle_ui_visibility');
        this.game.events.off('show_pause');
        this.game.events.off('hide_pause');
        this.game.events.off('show_game_over');
        this.game.events.off('show_onboarding');
        this.game.events.off('hide_onboarding');
        this.game.events.off('show_upgrade_selection');
        this.game.events.off('update_upgrade_selection');
        this.game.events.off('close_upgrade_selection');
    });

    this.scale.on('resize', this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.scale.off('resize', this.handleResize, this);
    });
  }

  handleResize(gameSize) {
    const width = gameSize.width;
    const barW = width * 0.5;
    const barX = (width - barW) * 0.5;
    const barY = 38; // Level Bar
    const odBarY = 50; // OD Bar closer to Level

    this.hudCombo.setPosition(width * 0.5, 98);
    this.hudFever.setPosition(width * 0.5, 138);
    this.pauseButton.setPosition(width - 24, 24);
    this.layoutTop();
    this.drawPowerupBar(0, ''); // Refresh bars position
  }

  layoutTop() {
    let nx = 16;
    this.hudScore.setPosition(nx, 18);
    nx += this.hudScore.width + 12;
    this.hudLevel.setPosition(nx, 18);
    nx += this.hudLevel.width + 12;
    this.hudWave.setPosition(nx, 18);
  }

  drawPowerupBar(powerupProgress, powerupLabel) {
    const { width } = this.scale;
    const barW = width * 0.5;
    const barH = 6;
    const barX = (width - barW) * 0.5;
    const barY = 50; // Powerup Bar (Moves it nicely below OD bar)

    this.powerupBarBg.clear();
    this.powerupBarFill.clear();
    this.powerupBarText.setText('');

    if (powerupProgress > 0) {
      this.powerupBarBg.fillStyle(0x223344, 0.4);
      this.powerupBarBg.fillRoundedRect(barX, barY, barW, barH - 2, 2);
      
      this.powerupBarFill.fillStyle(0xffaa22, 0.8);
      this.powerupBarFill.fillRoundedRect(barX, barY, barW * powerupProgress, barH - 2, 2);
      
      this.powerupBarText.setPosition(width * 0.5, barY + 12).setText(powerupLabel);
    }
  }

  drawOverdrive(charge, active) {
    const { width } = this.scale;
    const barW = width * 0.44;
    const barH = 7;
    const barX = (width - barW) * 0.5;
    const barY = 38; // OD Bar now at the top y position

    this.overdriveBarBg.clear();
    this.overdriveBarFill.clear();

    if (charge > 0 || active) {
        this.overdriveBarText.setVisible(true).setPosition(barX - 22, barY + 3.5);
        this.overdriveBarBg.fillStyle(0x223344, 0.4);
        this.overdriveBarBg.fillRoundedRect(barX, barY, barW, barH, 3);
        
        const color = active ? 0xff44aa : (charge >= 1 ? 0x00ffcc : 0x4a6a9a);
        this.overdriveBarFill.fillStyle(color, 0.9);
        this.overdriveBarFill.fillRoundedRect(barX, barY, barW * (active ? 1.0 : charge), barH, 3);
        
        if (charge >= 1 && !active) {
          const glowAlpha = 0.3 + Math.sin(this.time.now * 0.01) * 0.2;
          this.overdriveBarBg.lineStyle(2, 0xffffff, glowAlpha);
          this.overdriveBarBg.strokeRoundedRect(barX - 1, barY - 1, barW + 2, barH + 2, 3);
        }
    } else {
        this.overdriveBarText.setVisible(false);
    }
  }

  renderPauseOverlay(audioSettings) {
    if (!this.pauseOverlay) {
        this.pauseOverlay = this.add.container(0, 0).setDepth(230);
    }
    this.pauseOverlay.removeAll(true);
    this.pauseOverlay.setVisible(true);

    const { width, height } = this.scale;
    const playScene = this.scene.get('PlayScene');

    const panel = this.add
      .rectangle(width * 0.5, height * 0.53, width * 0.84, height * 0.62, 0x0c1220, 0.93)
      .setStrokeStyle(2, 0x5d84b6, 0.9);

    const title = this.add
      .text(width * 0.5, height * 0.32, 'PAUSED', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '40px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const makeBtn = (label, y, handler) =>
      this.add
        .text(width * 0.5, y, label, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '22px',
          fontStyle: 'bold',
          color: '#d9ebff',
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', handler);

    const createVolumeSlider = (label, y, value, onChange) => {
      const title = this.add
        .text(width * 0.5 - 120, y, label, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '15px',
          fontStyle: 'bold',
          color: '#c9daef',
        })
        .setOrigin(0, 0.5);

      const barW = 170;
      const barH = 12;
      const barX = width * 0.5 - 8;
      const bg = this.add
        .rectangle(barX, y, barW, barH, 0x1a2a40, 0.95)
        .setOrigin(0, 0.5)
        .setStrokeStyle(1, 0x6a89ad, 0.8)
        .setInteractive({ useHandCursor: true });
      const fill = this.add.rectangle(barX, y, barW * Phaser.Math.Clamp(value, 0, 1), barH, 0x76c3ff, 1).setOrigin(0, 0.5);
      const knob = this.add.circle(barX + barW * Phaser.Math.Clamp(value, 0, 1), y, 8, 0xe9f4ff, 1).setStrokeStyle(2, 0x5fa8e0, 1);
      const pct = this.add
        .text(barX + barW + 14, y, `${Math.round(Phaser.Math.Clamp(value, 0, 1) * 100)}`, {
          fontFamily: 'ui-monospace, monospace',
          fontSize: '13px',
          color: '#d6e8ff',
        })
        .setOrigin(0, 0.5);

      const update = (worldX) => {
        const ratio = Phaser.Math.Clamp((worldX - barX) / barW, 0, 1);
        fill.width = Math.max(2, barW * ratio);
        knob.x = barX + barW * ratio;
        pct.setText(`${Math.round(ratio * 100)}`);
        onChange(ratio);
      };

      bg.on('pointerdown', (pointer) => {
        update(pointer.worldX);
        this.game.events.emit('save_audio_settings');
      });
      
      knob.setInteractive({ useHandCursor: true, draggable: true });
      knob.on('drag', (pointer) => {
        update(pointer.worldX);
      });
      
      knob.on('dragend', () => {
        this.game.events.emit('save_audio_settings');
      });

      return [title, bg, fill, knob, pct];
    };

    const sfxSliderItems = createVolumeSlider('SFX', height * 0.455, audioSettings.sfxVolume ?? 0.85, (v) => {
      playScene.audio?.setSfxVolume(v);
    });

    const resume = makeBtn('Resume', height * 0.56, () => playScene.togglePauseByUser());
    const restart = makeBtn('Restart', height * 0.635, () => {
        playScene.scene.restart();
        this.scene.restart();
    });
    const menu = makeBtn('Menu', height * 0.71, () => {
        playScene.scene.stop();
        this.scene.start('Menu');
    });

    this.pauseOverlay.add([panel, title, ...sfxSliderItems, resume, restart, menu]);
  }

  renderGameOverOverlay(result) {
    console.log('[UIScene] Rendering Game Over Overlay:', result);
    
    // Cleanup any other potentially blocking overlays
    if (this.upgradeOverlay) {
        this.upgradeOverlay.destroy(true);
        this.upgradeOverlay = null;
    }
    if (this.onboardingOverlay) {
        this.onboardingOverlay.destroy(true);
        this.onboardingOverlay = null;
    }
    if (this.pauseOverlay) {
        this.pauseOverlay.setVisible(false);
    }

    if (!this.gameOverOverlay) {
        this.gameOverOverlay = this.add.container(0, 0).setDepth(250);
    }
    this.gameOverOverlay.removeAll(true);
    this.gameOverOverlay.setVisible(true).setAlpha(1);

    const { width, height } = this.scale;
    const playScene = this.scene.get('PlayScene');
    
    const run = result.run;
    const profile = result.profile;
    const upgrades = run.selectedUpgrades.length > 0 ? run.selectedUpgrades.join(', ') : '-';
    const panelWidth = Math.min(width * 0.9, 560);
    const panelHeight = Math.min(height * 0.78, 620);
    const panelX = (width - panelWidth) * 0.5;
    const panelY = Math.max(24, height * 0.1);

    const panel = this.add.graphics();
    panel.fillStyle(0x0b1020, 0.9);
    panel.lineStyle(2, 0x5c8fcf, 0.72);
    panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
    panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);

    const title = this.add
      .text(width * 0.5, panelY + 74, 'GAME OVER', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '46px',
        fontStyle: 'bold',
        color: '#ff6677',
      })
      .setOrigin(0.5);

    const lines = [
      `Score: ${run.score}`,
      `Level: ${run.level}`,
      result.isNewBest ? 'NEW BEST!' : `Best: ${profile.highScore}`,
      `Kills: ${run.runKills}`,
      `Time: ${this.formatDuration(run.runDurationMs)}`,
      `Max Combo: x${run.maxCombo}`,
      `Upgrades: ${upgrades}`,
      `Earned: ${run.coinsCollected} coins`,
    ];

    const stats = this.add
      .text(width * 0.5, panelY + panelHeight * 0.5, lines.join('\n'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        lineSpacing: 10,
        color: '#e0edff',
        align: 'center',
      })
      .setOrigin(0.5);

    const restartBtn = this.add
      .text(width * 0.5, panelY + panelHeight - 110, 'TRY AGAIN', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: '#3a5f8f',
        padding: { x: 32, y: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
          playScene.scene.restart();
          this.scene.restart();
      });

    const menuBtn = this.add
      .text(width * 0.5, panelY + panelHeight - 45, 'Back to Menu', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#88aadd',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
          playScene.scene.stop();
          this.scene.start('Menu');
      });

    this.gameOverOverlay.add([panel, title, stats, restartBtn, menuBtn]);
  }

  renderOnboardingStep(stepData) {
    console.log('[UIScene] Rendering Onboarding Step:', stepData.index);
    if (this.onboardingOverlay) this.onboardingOverlay.destroy(true);
    const { width, height } = this.scale;
    const playScene = this.scene.get('PlayScene');

    const container = this.add.container(0, 0).setDepth(245);
    const panel = this.add.rectangle(width * 0.5, height * 0.5, width * 0.82, height * 0.46, 0x0d1320, 0.95).setStrokeStyle(2, 0x66aaff, 0.9);
    const title = this.add
      .text(width * 0.5, height * 0.37, stepData.title, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '34px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    const body = this.add
      .text(width * 0.5, height * 0.47, stepData.body, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#d8e8ff',
        align: 'center',
      })
      .setOrigin(0.5);
    const indicator = this.add
      .text(width * 0.5, height * 0.67, `Step ${stepData.index + 1}/3 — Tap to continue`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#9db2cc',
      })
      .setOrigin(0.5);

    const demoItems = [];
    if (stepData.index === 0) {
      const arrow = this.add.text(width * 0.5, height * 0.56, '<   >', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '24px',
        color: '#88ddff',
      }).setOrigin(0.5);
      this.tweens.add({ targets: arrow, x: width * 0.5 + 70, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      demoItems.push(arrow);
    } else if (stepData.index === 1) {
      const bullet = this.add.image(width * 0.5, height * 0.6, 'bullet').setScale(1.4);
      this.tweens.add({ targets: bullet, y: height * 0.53, alpha: 0.3, duration: 450, repeat: -1 });
      demoItems.push(bullet);
    } else {
      const enemy = this.add.image(width * 0.5, height * 0.6, 'enemy').setScale(1.2).setTint(0xff6688);
      this.tweens.add({ targets: enemy, y: height * 0.65, duration: 700, yoyo: true, repeat: -1 });
      demoItems.push(enemy);
    }

    container.add([panel, title, body, indicator, ...demoItems]);
    this.onboardingOverlay = container;
  }

  renderUpgradeSelectionModal(data) {
    console.log('[UIScene] Rendering Upgrade Selection Modal. Rerolls:', data.rerolls);
    if (this.upgradeOverlay) {
      this.upgradeOverlay.destroy(true);
      this.upgradeOverlay = null;
    }

    const { width, height } = this.scale;
    const playScene = this.scene.get('PlayScene');
    
    const container = this.add.container(0, 0).setDepth(220).setVisible(true).setAlpha(1);
    const bg = this.add.rectangle(width * 0.5, height * 0.5, width, height, 0x000000, 0.6).setInteractive();
    
    const title = this.add
      .text(width * 0.5, height * 0.18, 'Draft Upgrade', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '32px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const rerollLabel = data.rerolls > 0 ? `Reroll (${data.rerolls})` : 'Reroll (0)';
    const rerollBtn = this.add
      .text(width * 0.5, height * 0.26, rerollLabel, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: data.rerolls > 0 ? '#88ffcc' : '#556677',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: data.rerolls > 0 });

    if (data.rerolls > 0) {
      rerollBtn.on('pointerdown', () => this.game.events.emit('reroll_draft'));
    }

    const hint = this.add
      .text(width * 0.5, height * 0.31, 'Banish removes one card from this draft pool.', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#8899aa',
      })
      .setOrigin(0.5);

    const startX = width * 0.2;
    const gap = width * 0.3;
    const rarityGlow = { Common: 0x33cc88, Rare: 0x55aaff, Epic: 0xaa66ff };

    data.choices.forEach((choice, i) => {
      const x = startX + i * gap;
      const y = height * 0.52;
      const cardContainer = this.add.container(x, y + 40).setAlpha(0);
      const glow = this.add.rectangle(0, 0, 126, 172, rarityGlow[choice.rarity] || 0xffffff, 0.15);
      const card = this.add
        .rectangle(0, 0, 116, 158, 0x0f1325, 0.95)
        .setStrokeStyle(2, choice.color || 0x445566, 1)
        .setInteractive({ useHandCursor: true });

      const name = this.add
        .text(0, -42, choice.label, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: 100 },
        })
        .setOrigin(0.5);

      const stackLine = this.add
        .text(0, -14, choice.stackLabel, {
          fontFamily: 'ui-monospace, monospace',
          fontSize: '11px',
          color: '#ffeeaa',
        })
        .setOrigin(0.5);

      const desc = this.add
        .text(0, 24, choice.desc, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '11px',
          color: '#bdeeff',
          align: 'center',
          wordWrap: { width: 100 },
        })
        .setOrigin(0.5);

      const banishBtn = this.add
        .text(0, 68, 'Banish', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '12px',
          color: '#ff88aa',
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.game.events.emit('banish_slot', i));

      card.on('pointerdown', () => {
          this.tweens.add({
              targets: cardContainer,
              scale: 1.1,
              alpha: 0,
              duration: 200,
              onComplete: () => this.game.events.emit('select_upgrade', choice.key)
          });
      });

      cardContainer.add([glow, card, name, stackLine, desc, banishBtn]);
      this.tweens.add({
        targets: cardContainer,
        y, alpha: 1,
        duration: 300,
        ease: 'Back.out',
        delay: i * 80,
      });
      container.add(cardContainer);
    });

    container.add([bg, title, rerollBtn, hint]);
    container.sendToBack(bg);
    this.upgradeOverlay = container;
  }

  formatDuration(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
  }
}

