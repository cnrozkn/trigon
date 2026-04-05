import * as Phaser from 'phaser';
import { checkNewAchievements } from '../systems/AchievementSystem.js';
import { loadGameProfile, saveGameProfile, saveAudioSettings } from '../utils/Storage.js';
import WaveManager from '../systems/WaveManager.js';
import PowerupSystem from '../systems/PowerupSystem.js';
import { buildEnemyConfig } from '../systems/EnemyFactory.js';
import {
  applyGameOverCombatCleanup,
  computeBulletTrailIntervalMs,
  isGameplayActionPaused,
} from '../systems/combatRuntime.js';

const START_PLAYER_COUNT = 1;
const MAX_PLAYER_COUNT = 6;

const BASE_FIRE_MS = 380;
const MIN_FIRE_MS = 120;

const DRAFT_REROLLS = 2;
const COMBO_WINDOW_MS = 2500;
const FEVER_STREAK_THRESHOLD = 60;
const FEVER_DURATION_MS = 8000;
const FEVER_COOLDOWN_MS = 1500;
const NEAR_MISS_RADIUS_PX = 30;
const NEAR_MISS_COOLDOWN_MS = 650;
const LEVEL_CLEAR_RETRY_MS = 500;
const DEATH_ORB_LIFETIME_MS = 1700;
const DEATH_ORB_BASE_SPEED = 210;
const DEATH_ORB_ARM_DELAY_MS = 120;
const BULLET_HIT_LOCK_MS = 45;
const BULLET_PIERCE_IFRAME_MS = 36;
const BOSS_BASE_ATTACK_MS = 1650;

/** Inner playfield inset from logical screen edges (enemy bounce + frame). */
const PLAYFIELD_MARGIN = 22;
/** Boss half-width-ish for horizontal clamp / wall reflection. */
const BOSS_X_PAD = 56;

/** Single source for caps (must match canOfferUpgrade / apply logic). */
const UPGRADE_MAX = {
  fire: 6,
  damage: 5,
  shield: 5,
  triangle: MAX_PLAYER_COUNT,
  pierce: 3,
  multi: 2,
  crit: 4,
  frost: 3,
};

const UPGRADE_DEFS = [
  { key: 'fire', label: 'Rapid Fire', desc: '+Fire rate', rarity: 'Common', weight: 6, color: 0x22cc88 },
  { key: 'damage', label: 'Heavy Rounds', desc: '+Bullet damage', rarity: 'Common', weight: 6, color: 0xcc8822 },
  { key: 'shield', label: 'Shield Core', desc: '+1 shield charge', rarity: 'Common', weight: 6, color: 0x4488ff },
  { key: 'triangle', label: 'Tri-Fleet', desc: '+1 triangle', rarity: 'Rare', weight: 3, color: 0x55aaff },
  { key: 'pierce', label: 'Piercing Shots', desc: '+bullet pierce', rarity: 'Rare', weight: 3, color: 0xffcc66 },
  { key: 'multi', label: 'Multi Shot', desc: 'Add side bullets', rarity: 'Rare', weight: 3, color: 0xff66cc },
  { key: 'crit', label: 'Critical Core', desc: '+crit chance', rarity: 'Rare', weight: 3, color: 0xff9966 },
  { key: 'frost', label: 'Frost Rounds', desc: 'Hit can slow enemy', rarity: 'Epic', weight: 1, color: 0x66e6ff },
];

const ENDLESS_UPGRADE_DEFS = [
  { key: 'endlessOverclock', label: 'Overclock Loop', desc: 'Slightly faster fire rate', rarity: 'Rare', weight: 2, color: 0x44ddaa, repeatable: true },
  { key: 'endlessBounty', label: 'Bounty Protocol', desc: 'Small permanent score gain', rarity: 'Common', weight: 5, color: 0xffd36a, repeatable: true },
  { key: 'endlessCloseCall', label: 'Close Call Engine', desc: 'Near-miss rewards improve', rarity: 'Epic', weight: 2, color: 0xff99cc, repeatable: true },
];

const COSMETIC_COLORS = {
  pink: 0xff66cc,
  lime: 0x66ff66,
  gold: 0xffd700,
};

function playerTintForLevel(level, cosmeticId) {
  if (cosmeticId && cosmeticId !== 'default' && COSMETIC_COLORS[cosmeticId]) {
    return COSMETIC_COLORS[cosmeticId];
  }
  if (level < 5) return 0xffffff;
  if (level < 10) return 0x00ff88;
  if (level < 15) return 0x00ffff;
  return 0xff66cc;
}

function enemyColorForLevel(level) {
  if (level < 5) return 0xff66aa;
  if (level < 10) return 0xff8877;
  if (level < 15) return 0xffaa55;
  return 0xff4444;
}

function enemySpeedMultiplier(level) {
  return 0.8 + 2.2 / (1 + Math.exp(-0.25 * (level - 8)));
}

function regularEnemySpeedMultiplier(level) {
  if (level <= 2) return 1;
  if (level <= 6) return 1 + (level - 2) * 0.052;
  if (level <= 12) return 1.208 + (level - 6) * 0.043;
  if (level <= 15) return 1.48 + (level - 12) * 0.05;
  return Math.min(2.45, 1.63 + (level - 15) * 0.075);
}

function backgroundToneForLevel(level) {
  if (level < 5) return 0x0a1022;
  if (level < 10) return 0x1a0d2a;
  if (level < 15) return 0x2a1018;
  return 0x2a1d08;
}

export default class PlayScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PlayScene' });
  }

  init(data) {
    this.challenge = data?.challenge || null;
    this.mutators = this.challenge?.mutators || {};

    const profile = loadGameProfile();
    this.profile = profile;

    this.score = 0;
    this.currentLevel = 1;
    this.levelClearPending = false;

    this.formationX = 0;
    this.targetFormationX = 0;
    this.playerHalfSpread = 24;
    this.playerBaseY = 0;

    this.gameOver = false;
    this.isChoosingUpgrade = false;
    this.waveManager = null;
    this.powerupSystem = null;

    // Roguelite build state
    const u = this.profile?.upgrades || {};
    this.fireRateLevel = u.baseSpeed || 0;
    this.damageLevel = u.baseDamage || 0;
    this.shieldCharges = this.mutators.noShields ? 0 : (u.baseShield || 0);
    this.nearMissOffset = (u.nearMissRange || 0) * 10;
    this.coinBoost = u.coinMultiplier || 0;
    this.extraRerolls = u.extraReroll || 0;
    this.difficultyOffset = Object.values(u).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);

    this.pierceLevel = 0;
    this.multishotLevel = 0;
    this.critLevel = 0;
    this.frostLevel = 0;

    this.coinsCollected = 0;

    this.upgradeModal = null;
    this.overlayBg = null;
    this.draftBanishedKeys = new Set();
    this.draftRerollsLeft = 0;
    this.draftChoices = [];
    this.upgradePicking = false;
    this.nextLevelFlowRetryAt = 0;

    this.playLeft = PLAYFIELD_MARGIN;
    this.playRight = 0;
    this.playfieldFrame = null;
    this.playfieldPulseWidth = 2;
    this.playfieldPulseTween = null;

    this.bgTone = null;
    this.bgGlow = null;
    this.bgGridFar = null;
    this.bgGridNear = null;
    this.bgTargetTone = backgroundToneForLevel(1);
    this.bgCurrentTone = this.bgTargetTone;
    this.feverEdgeGlow = null;
    this.lowShieldVignette = null;

    this.trailLastAt = 0;
    this.prevFormationX = 0;
    this.shieldRingG = null;

    this.muzzleFx = null;
    this.bulletTrailFx = null;
    this.impactFx = null;
    this.geoBurst = null;

    this.hitStopActive = false;
    this.hitStopRestoreId = null;
    this.screenFlash = null;

    this.audio = null;
    this.killStreak = 0;
    this.runKills = 0;
    this.maxCombo = 0;
    this.feverActivated = false;
    this.perfectLevels = 0;
    this.tookDamageInLevel = false;
    this.coinsCollected = 0;
    this.comboScoreMultiplier = 1;
    this.nearMissStreak = 0;
    this.nearMissLastAt = 0;
    this.feverActive = false;
    this.feverEndsAt = 0;
    this.feverCooldownUntil = 0;
    this.runKills = 0;
    this.runStartMs = 0;
    this.selectedUpgrades = [];
    this.endlessFireFactor = 1;
    this.endlessScoreBonus = 0;
    this.endlessNearMissBonus = 0;
    this.endlessPicks = 0;

    this.pauseButton = null;
    this.pauseOverlay = null;
    this.isPausedByUser = false;
    this.isGameOverScreenVisible = false;
    this.gameOverOverlay = null;
    this.gameOverResult = null;

    this.profile = loadGameProfile();
    this.shieldFlashUntil = 0;
    this.shieldFlashIndex = -1;
    this.onboardingActive = false;
    this.onboardingIndex = 0;
    this.onboardingOverlay = null;
    this.onboardingTimer = null;
    this.onboardingArrow = null;
    this.onboardingPreviewBullet = null;
    this.onboardingEnemyPreview = null;

    this.hudLevel = null;
    this.hudWave = null;
    this.hudCombo = null;
    this.hudFever = null;
    this.progressBarBg = null;
    this.progressBarFill = null;
    this.powerupBarBg = null;
    this.powerupBarFill = null;
    this.powerupBarText = null;
  }

  /** World bounds: narrow X for side bounce; open top/bottom for spawn & recycle. */
  applyPlayfieldWorldBounds(width, height) {
    this.playLeft = PLAYFIELD_MARGIN;
    this.playRight = width - PLAYFIELD_MARGIN;
    const playW = this.playRight - this.playLeft;
    const topY = -320;
    const boundsH = height - topY + 420;
    this.physics.world.setBounds(this.playLeft, topY, playW, boundsH);
    this.physics.world.setBoundsCollision(true, true, false, false);
  }

  drawPlayfieldFrame(width, height, lineWidth = this.playfieldPulseWidth || 2) {
    if (this.playfieldFrame) this.playfieldFrame.destroy();
    const g = this.add.graphics().setDepth(3);
    g.lineStyle(lineWidth, 0x4a6a9a, 0.55);
    g.strokeRect(this.playLeft + 1, 6, this.playRight - this.playLeft - 2, height - 12);
    g.lineStyle(1, 0x223355, 0.35);
    g.strokeRect(this.playLeft + 3, 8, this.playRight - this.playLeft - 6, height - 16);
    this.playfieldFrame = g;
  }

  ensureStageOneTextures() {
    if (!this.textures.exists('stage1_grid_line')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.clear();
      g.fillStyle(0x64b4ff, 0.08);
      g.fillRect(0, 0, 2, 2);
      g.generateTexture('stage1_grid_line', 2, 2);
      g.destroy();
    }

    if (!this.textures.exists('particle_triangle')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xff99dd, 1);
      g.beginPath();
      g.moveTo(6, 0);
      g.lineTo(0, 12);
      g.lineTo(12, 12);
      g.closePath();
      g.fillPath();
      g.generateTexture('particle_triangle', 12, 12);
      g.destroy();
    }
  }

  createBackgroundLayer(width, height) {
    this.bgTone = this.add.rectangle(width * 0.5, height * 0.5, width, height, this.bgCurrentTone, 0.35).setDepth(-30);
    this.bgGlow = this.add.ellipse(width * 0.5, height * 0.55, width * 1.2, height * 1.4, 0x4a3d88, 0.05).setDepth(-29);
    this.bgGridFar = this.add.tileSprite(width * 0.5, height * 0.5, width, height, 'stage1_grid_line').setDepth(-28);
    this.bgGridFar.setTint(0x64b4ff).setAlpha(0.12).setBlendMode(Phaser.BlendModes.ADD);
    this.bgGridNear = this.add.tileSprite(width * 0.5, height * 0.5, width, height, 'stage1_grid_line').setDepth(-27);
    this.bgGridNear.setTint(0x7a9fff).setAlpha(0.06).setBlendMode(Phaser.BlendModes.ADD).setScale(0.5);
  }

  refreshBackgroundLayout(width, height) {
    if (this.bgTone) this.bgTone.setPosition(width * 0.5, height * 0.5).setSize(width, height);
    if (this.bgGlow) this.bgGlow.setPosition(width * 0.5, height * 0.55).setSize(width * 1.2, height * 1.4);
    if (this.bgGridFar) this.bgGridFar.setPosition(width * 0.5, height * 0.5).setSize(width, height);
    if (this.bgGridNear) this.bgGridNear.setPosition(width * 0.5, height * 0.5).setSize(width, height);
  }

  handleResize(gameSize) {
    const width = gameSize.width;
    const height = gameSize.height;

    this.applyPlayfieldWorldBounds(width, height);
    this.drawPlayfieldFrame(width, height);
    this.refreshBackgroundLayout(width, height);
    this.playerBaseY = height - 90;

    const minX = this.playLeft + this.playerHalfSpread;
    const maxX = this.playRight - this.playerHalfSpread;
    this.formationX = Phaser.Math.Clamp(this.formationX, minX, maxX);
    this.targetFormationX = Phaser.Math.Clamp(this.targetFormationX, minX, maxX);
    this.relayoutFleet();

    this.layoutTopHud();
    if (this.hudCombo) this.hudCombo.setPosition(width * 0.5, 88);
    if (this.hudFever) this.hudFever.setPosition(width * 0.5, 128);
    if (this.pauseButton) this.pauseButton.setPosition(width - 24, 24);

    if (this.overlayBg) {
      this.overlayBg.setPosition(width * 0.5, height * 0.5);
      this.overlayBg.setSize(width, height);
    }
    if (this.screenFlash) this.screenFlash.setPosition(width * 0.5, height * 0.5).setSize(width, height);
    if (this.feverEdgeGlow) this.feverEdgeGlow.setPosition(width * 0.5, height * 0.5).setSize(width, height);
    if (this.lowShieldVignette) this.lowShieldVignette.setPosition(width * 0.5, height * 0.64).setSize(width * 1.3, height * 1.7);
    if (this.isPausedByUser) this.renderPauseOverlay();
    if (this.isGameOverScreenVisible) this.renderGameOverOverlay();
    if (this.onboardingActive) this.renderOnboardingStep();

    this.enemies.children.iterate((e) => {
      if (!e || !e.active) return true;
      e.x = Phaser.Math.Clamp(e.x, this.playLeft + 12, this.playRight - 12);
      if (e.body) {
        const prevVx = e.body.velocity.x;
        const prevVy = e.body.velocity.y;
        e.body.reset(e.x, e.y);
        e.body.setVelocity(prevVx, prevVy);
      }
      return true;
    });

    if (this.isChoosingUpgrade) this.renderDraftModal();
  }

  create() {
    const { width, height } = this.scale;
    this.ensureStageOneTextures();
    this.createBackgroundLayer(width, height);
    this.audio = this.registry.get('audio') || null;
    // Fallback unlock: menu tap should already resume; this covers slow resume or suspended tab.
    if (this.audio && typeof this.audio.resume === 'function') {
      this.input.once('pointerdown', () => {
        void this.audio.resume();
      });
    }
    this.applyPlayfieldWorldBounds(width, height);
    this.drawPlayfieldFrame(width, height);

    this.deathBurst = this.add.particles(0, 0, 'particle_square', {
      speed: { min: 80, max: 320 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 450,
      blendMode: 'ADD',
      emitting: false,
    });

    this.sparkle = this.add.particles(0, 0, 'particle_dot', {
      speed: { min: 40, max: 180 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0 },
      lifespan: 350,
      tint: [0xff66cc, 0x66ffff, 0xffffff],
      blendMode: 'ADD',
      emitting: false,
    });

    this.geoBurst = this.add.particles(0, 0, 'particle_triangle', {
      speed: { min: 70, max: 240 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.75, end: 0 },
      lifespan: 300,
      blendMode: 'ADD',
      emitting: false,
    });

    this.muzzleFx = this.add.particles(0, 0, 'particle_dot', {
      speed: { min: 40, max: 130 },
      angle: { min: -115, max: -65 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [0xffffff, 0x88ffff],
      lifespan: 80,
      blendMode: 'ADD',
      emitting: false,
    });

    this.bulletTrailFx = this.add.particles(0, 0, 'particle_dot', {
      speed: { min: 0, max: 15 },
      scale: { start: 0.45, end: 0 },
      alpha: { start: 0.4, end: 0 },
      tint: [0x88ffff, 0x66e6ff],
      lifespan: 150,
      blendMode: 'ADD',
      emitting: false,
    });

    this.impactFx = this.add.particles(0, 0, 'particle_dot', {
      speed: { min: 40, max: 210 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.75, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xffffff, 0x66ffff, 0xffdd88],
      lifespan: 170,
      blendMode: 'ADD',
      emitting: false,
    });

    this.players = this.physics.add.group();
    this.bullets = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite, maxSize: 220 });
    this.enemyBullets = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite, maxSize: 260 });
    this.enemies = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite });

    this.playerBaseY = height - 90;
    this.formationX = width / 2;
    this.targetFormationX = this.formationX;
    this.prevFormationX = this.formationX;
    this.runStartMs = this.time.now;
    this.shieldRingG = this.add.graphics().setDepth(12);
    this.screenFlash = this.add
      .rectangle(width * 0.5, height * 0.5, width, height, 0xffffff, 0)
      .setDepth(260)
      .setVisible(false);
    this.feverEdgeGlow = this.add.rectangle(width * 0.5, height * 0.5, width, height, 0xff66dd, 0).setDepth(150);
    this.lowShieldVignette = this.add.ellipse(width * 0.5, height * 0.64, width * 1.3, height * 1.7, 0xff4455, 0).setDepth(140);

    for (let i = 0; i < START_PLAYER_COUNT; i++) this.addPlayerToFleet();

    this.hudScore = this.add
      .text(16, 18, 'Score: 0', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#aaffff',
      })
      .setOrigin(0, 0.5)
      .setDepth(100);
    this.hudLevel = this.add
      .text(16, 18, 'LV.1', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ccddff',
      })
      .setOrigin(0, 0.5)
      .setDepth(100);
    this.hudWave = this.add
      .text(16, 18, 'WAVE 0/0', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#9fd6ff',
      })
      .setOrigin(0, 0.5)
      .setDepth(100);
    this.hudCombo = this.add
      .text(width * 0.5, 88, 'x0', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '34px',
        fontStyle: 'bold',
        color: '#ffe080',
      })
      .setOrigin(0.5)
      .setDepth(110)
      .setAlpha(0);
    this.hudFever = this.add
      .text(width * 0.5, 128, 'FEVER!', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '40px',
        fontStyle: 'bold',
        color: '#ff78ff',
      })
      .setOrigin(0.5)
      .setDepth(112)
      .setAlpha(0);
    this.pauseButton = this.add
      .text(width - 24, 24, '||', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#d7e8ff',
      })
      .setOrigin(1, 0.5)
      .setDepth(120)
      .setInteractive({ useHandCursor: true });
    this.pauseButton.on('pointerdown', () => this.togglePauseByUser());

    this.overlayBg = this.add
      .rectangle(width * 0.5, height * 0.5, width, height, 0x04050a, 0)
      .setDepth(180)
      .setVisible(false);
    this.pauseOverlay = this.add.container(0, 0).setDepth(230).setVisible(false);
    this.gameOverOverlay = this.add.container(0, 0).setDepth(250).setVisible(false);

    this.physics.add.overlap(this.bullets, this.enemies, this.onBulletHitEnemy, undefined, this);
    this.physics.add.overlap(this.players, this.enemies, this.onPlayerHitEnemy, undefined, this);
    this.physics.add.overlap(this.players, this.enemyBullets, this.onPlayerHitEnemyBullet, undefined, this);
    this.physics.add.overlap(this.bullets, this.enemyBullets, this.onBulletHitEnemyBullet, undefined, this);

    this.resetFireTimer();

    this.powerupSystem = new PowerupSystem(this);
    this.powerupSystem.create();
    this.waveManager = new WaveManager(this, {
      onSpawn: (spawn, wave) => this.spawnFromWave(spawn, wave),
      onWaveStart: (ctx, wave) => this.onWaveStarted(ctx, wave),
      onWaveClear: (ctx) => this.onWaveCleared(ctx),
      onLevelClear: (ctx) => this.onLevelCleared(ctx),
    });
    this.waveManager.startLevel(this.currentLevel);

    this.input.on('pointermove', (pointer) => {
      if (!this.gameOver && !this.isChoosingUpgrade && !this.onboardingActive) this.targetFormationX = pointer.worldX;
    });
    this.input.on('pointerdown', (pointer) => {
      this.audio?.resume();
      if (this.onboardingActive) {
        this.advanceOnboarding();
        return;
      }
      if (!this.gameOver && !this.isChoosingUpgrade) this.targetFormationX = pointer.worldX;
    });

    this.onResize = (gameSize) => this.handleResize(gameSize);
    this.scale.on('resize', this.onResize);
    this.updateHud();
    if (this.profile.totalGamesPlayed === 0) this.startOnboarding();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.onResize);
      if (this.playfieldFrame) this.playfieldFrame.destroy();
      this.playfieldFrame = null;
      if (this.shieldRingG) this.shieldRingG.destroy();
      this.shieldRingG = null;
      if (this.hitStopRestoreId) {
        clearTimeout(this.hitStopRestoreId);
        this.hitStopRestoreId = null;
      }
      if (this.onboardingTimer) {
        this.onboardingTimer.remove(false);
        this.onboardingTimer = null;
      }
      this.waveManager = null;
      this.powerupSystem = null;
    });
  }

  update(_time, delta) {
    this.updateBackgroundFx(delta);
    const gameplayPaused = isGameplayActionPaused(this);
    // Keep pickup cleanup active even when gameplay is paused by overlays.
    this.powerupSystem?.update(this.time.now, { timersPaused: gameplayPaused });
    if (gameplayPaused) return;
    if (this.levelClearPending && this.time.now >= this.nextLevelFlowRetryAt) {
      this.nextLevelFlowRetryAt = this.time.now + LEVEL_CLEAR_RETRY_MS;
      this.tryOpenLevelTransition();
    }
    this.waveManager?.update(delta);
    if (this.feverActive && this.time.now >= this.feverEndsAt) this.endFeverMode();
    if (this.killStreak > 0 && this.time.now - this.lastKillAt > COMBO_WINDOW_MS) this.onComboBreak();
    if (this.killStreak > 1) this.updateComboHud();

    const { width } = this.scale;
    const minX = this.playLeft + this.playerHalfSpread;
    const maxX = this.playRight - this.playerHalfSpread;
    this.targetFormationX = Phaser.Math.Clamp(this.targetFormationX, minX, maxX);
    this.formationX = Phaser.Math.Linear(this.formationX, this.targetFormationX, 0.22);
    this.emitPlayerTrail();

    this.players.children.iterate((p) => {
      if (!p || !p.active) return;
      const ox = p.getData('offsetX') || 0;
      p.setPosition(this.formationX + ox, this.playerBaseY);
      p.body.reset(p.x, p.y);
      return true;
    });

    this.enemies.children.iterate((e) => {
      if (!e || !e.active) return;

      const txt = e.getData('healthText');
      const hpTextYOffset = e.getData('hpTextYOffset') || 0;
      if (txt && txt.active) txt.setPosition(e.x, e.y + hpTextYOffset);

      const slowUntil = e.getData('slowUntil') || 0;
      const localSlow = slowUntil > this.time.now ? 0.6 : 1;
      const globalSlow = this.powerupSystem?.getGlobalSlowMultiplier() ?? 1;
      const slowFactor = localSlow * globalSlow;
      const enemyType = e.getData('enemyType') || 'circle';

      if (e.getData('isBoss')) {
        const t = this.time.now * 0.001;
        const pattern = e.getData('pattern');
        const baseVy = 40 + this.currentLevel * 2;
        const lo = this.playLeft + BOSS_X_PAD;
        const hi = this.playRight - BOSS_X_PAD;
        const amp0 = (74 + this.currentLevel * 3.2) * slowFactor;
        const amp1 = (88 + this.currentLevel * 3.2) * slowFactor;

        if (pattern === 0) {
          let vx = Math.sin(t * 2.0) * amp0;
          if (e.x <= lo + 1 && vx < 0) vx = Math.abs(vx);
          if (e.x >= hi - 1 && vx > 0) vx = -Math.abs(vx);
          e.setVelocityX(vx);
          e.setVelocityY(baseVy * enemySpeedMultiplier(this.currentLevel) * slowFactor);
        } else {
          let vx = Math.cos(t * 2.7) * amp1;
          if (e.x <= lo + 1 && vx < 0) vx = Math.abs(vx);
          if (e.x >= hi - 1 && vx > 0) vx = -Math.abs(vx);
          e.setVelocityX(vx);
          e.setVelocityY((baseVy + 24) * enemySpeedMultiplier(this.currentLevel) * slowFactor);
        }
        const nextBossAttackAt = e.getData('nextBossAttackAt') || 0;
        if (this.time.now >= nextBossAttackAt) {
          this.fireBossAttackPattern(e);
          const attackCadence = Math.max(720, BOSS_BASE_ATTACK_MS - this.currentLevel * 26);
          e.setData('nextBossAttackAt', this.time.now + attackCadence);
        }
      } else {
        const baseVy = e.getData('baseVy') || 45;
        const slowMult = slowFactor * (this.mutators.globalSpeed || 1);
        const vy = baseVy * slowMult * regularEnemySpeedMultiplier(this.currentLevel);

        if (enemyType === 'zigzag') {
          const t = this.time.now * 0.001;
          const amp = e.getData('zigzagAmp') || 100;
          const freq = e.getData('zigzagFreq') || 4.4;
          e.setVelocityX(Math.sin((e.getData('zigzagSeed') || 0) + t * freq) * amp * slowMult);
          e.setVelocityY(vy);
        } else if (enemyType === 'shooter') {
          const stopY = e.getData('stopY') || 180;
          if (e.y < stopY) {
            e.setVelocity(0, vy);
          } else {
            e.setVelocity(0, 0);
            const nextShootAt = e.getData('nextShootAt') || 0;
            if (this.time.now >= nextShootAt) {
              this.spawnEnemyBulletAtPlayer(e.x, e.y + 18);
              const baseShootMs = e.getData('shootEveryMs') || 2000;
              const cadenceScale = (1 + Math.max(0, this.currentLevel - 2) * 0.035) * (this.mutators.enemyFireRate || 1);
              const shootDelay = Math.max(800, Math.round(baseShootMs / cadenceScale));
              e.setData('nextShootAt', this.time.now + shootDelay);
            }
          }
        } else {
          e.setVelocityX((e.getData('baseVx') || 0) * slowMult);
          e.setVelocityY(vy);
        }
      }
      return true;
    });

    const activeBulletCount = this.bullets?.countActive?.(true) ?? 0;
    const trailIntervalMs = computeBulletTrailIntervalMs({
      activeBulletCount,
      feverActive: this.feverActive,
    });
    this.bullets.children.iterate((b) => {
      if (b && b.active) {
        if (b.y < -55) this.recycleBullet(b);
        else this.emitBulletTrail(b, trailIntervalMs);
      }
      return true;
    });
    this.enemyBullets.children.iterate((b) => {
      if (!b || !b.active) return true;
      if (b.getData('isDeathOrb')) {
        const orbUntil = b.getData('deathOrbUntil') || 0;
        if (this.time.now >= orbUntil) {
          this.recycleEnemyBullet(b);
          return true;
        }
        const pulse = 1.55 + (Math.sin(this.time.now * 0.018 + b.x * 0.03) + 1) * 0.22;
        b.setScale(pulse);
        if (!b.body.checkCollision.none) {
          b.setAlpha(0.75 + (Math.sin(this.time.now * 0.02) + 1) * 0.12);
        }
      }
      if (
        b.y > this.scale.height + 55 ||
        b.y < -55 ||
        b.x < this.playLeft - 35 ||
        b.x > this.playRight + 35
      ) {
        this.recycleEnemyBullet(b);
      }
      return true;
    });

    this.enemies.children.iterate((e) => {
      if (e && e.active && e.y > this.scale.height + 95) this.recycleEnemy(e);
      return true;
    });
    this.drawShieldRings();
    this.prevFormationX = this.formationX;
    this.checkNearMisses();
  }

  updateBackgroundFx(delta = 16.6) {
    this.bgTargetTone = this.feverActive ? 0x3a0f46 : backgroundToneForLevel(this.currentLevel);
    this.bgCurrentTone = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(this.bgCurrentTone),
      Phaser.Display.Color.ValueToColor(this.bgTargetTone),
      100,
      4,
    ).color;

    if (this.bgTone) this.bgTone.setFillStyle(this.bgCurrentTone, this.feverActive ? 0.52 : 0.38);
    if (this.bgGridFar) this.bgGridFar.tilePositionY -= (18 * delta) / 1000;
    if (this.bgGridNear) this.bgGridNear.tilePositionY -= (11 * delta) / 1000;
    if (this.bgGlow) {
      const pulse = this.feverActive
        ? 0.09 + (Math.sin(this.time.now * 0.0012) + 1) * 0.05
        : 0.03 + (Math.sin(this.time.now * 0.00072) + 1) * 0.025;
      this.bgGlow.setAlpha(pulse);
      this.bgGlow.setFillStyle(this.feverActive ? 0xff44ee : 0x4a3d88, 1);
    }
    if (this.feverEdgeGlow) {
      const edgePulse = this.feverActive ? 0.1 + (Math.sin(this.time.now * 0.0028) + 1) * 0.06 : 0;
      this.feverEdgeGlow.setAlpha(edgePulse);
    }
    if (this.hudFever) {
      if (this.feverActive) {
        this.hudFever.setAlpha(0.75 + (Math.sin(this.time.now * 0.01) + 1) * 0.1);
        this.hudFever.setScale(1 + Math.sin(this.time.now * 0.014) * 0.05);
      } else {
        this.hudFever.setAlpha(0);
        this.hudFever.setScale(1);
      }
    }
    if (this.lowShieldVignette) {
      const danger = this.shieldCharges === 1 && !this.gameOver && !this.isChoosingUpgrade;
      const vignetteAlpha = danger ? 0.08 + (Math.sin(this.time.now * 0.0065) + 1) * 0.06 : 0;
      this.lowShieldVignette.setAlpha(vignetteAlpha);
    }
  }

  emitPlayerTrail() {
    const speed = Math.abs(this.formationX - this.prevFormationX);
    if (speed < 0.8) return;
    const interval = Phaser.Math.Clamp(95 - speed * 4, 32, 95);
    if (this.time.now - this.trailLastAt < interval) return;
    this.trailLastAt = this.time.now;

    this.players.children.iterate((p) => {
      if (!p || !p.active) return true;
      const ghost = this.add.image(p.x, p.y + 2, 'player').setDepth(7.5);
      ghost.setTintFill(0x66d9ff).setAlpha(0.25).setScale(0.95);
      this.tweens.add({
        targets: ghost,
        alpha: 0,
        scale: 1.2,
        duration: 200,
        ease: 'Sine.easeOut',
        onComplete: () => ghost.destroy(),
      });
      return true;
    });
  }

  drawShieldRings() {
    if (!this.shieldRingG) return;
    this.shieldRingG.clear();
    if (this.shieldCharges <= 0) return;

    const baseR = this.playerHalfSpread + 24;
    for (let i = 0; i < this.shieldCharges; i++) {
      const phase = this.time.now * 0.0021 + i * 1.1;
      const x = this.formationX + Math.cos(phase) * 5;
      const y = this.playerBaseY + Math.sin(phase) * 3;
      const r = baseR + i * 7;
      this.shieldRingG.lineStyle(1.4, 0x4488ff, 0.45 + i * 0.08);
      this.shieldRingG.strokeCircle(x, y, r);
    }
  }

  emitMuzzleFlash(x, y) {
    if (this.muzzleFx) this.muzzleFx.explode(4, x, y);
  }

  emitBulletTrail(bullet, intervalMs = 34) {
    if (!this.bulletTrailFx) return;
    const nextAt = bullet.getData('trailAt') || 0;
    if (this.time.now < nextAt) return;
    this.bulletTrailFx.explode(1, bullet.x, bullet.y + 8);
    bullet.setData('trailAt', this.time.now + intervalMs);
  }

  emitImpactBurst(x, y, crit) {
    if (this.impactFx) this.impactFx.explode(crit ? 10 : 5, x, y);
    if (this.geoBurst) this.geoBurst.explode(crit ? 8 : 4, x, y);
    if (crit) this.showFloatingText('+CRIT', x, y - 14, { color: '#ffdd77', size: 20, duration: 520 });
  }

  showDamagePopup(x, y, damage, crit, frostApplied) {
    let label = String(damage);
    if (crit) label = `${damage}!`;
    if (frostApplied) label = `FROST ${damage}`;
    this.showFloatingText(label, x, y - 8, {
      color: crit ? '#ffcc55' : frostApplied ? '#88ddff' : '#ffffff',
      size: crit ? 24 : 14,
      duration: crit ? 620 : 420,
      scaleFrom: crit ? 0.7 : 1,
    });
  }

  showFloatingText(text, x, y, opts = {}) {
    const popup = this.add
      .text(x, y, text, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: `${opts.size || 14}px`,
        fontStyle: 'bold',
        color: opts.color || '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(70)
      .setScale(opts.scaleFrom || 1);

    this.tweens.add({
      targets: popup,
      y: y - 24,
      alpha: 0,
      scale: 1.05,
      duration: opts.duration || 420,
      ease: 'Sine.easeOut',
      onComplete: () => popup.destroy(),
    });
  }

  checkNearMisses() {
    const players = this.players?.getChildren?.().filter((p) => p?.active) || [];
    if (players.length === 0) return;
    const now = this.time.now;
    const actualRadius = NEAR_MISS_RADIUS_PX + (this.nearMissOffset || 0);
    const radiusSq = actualRadius * actualRadius;

    this.enemies.children.iterate((enemy) => {
      if (!enemy || !enemy.active) return true;
      const nextAllowedAt = enemy.getData('nearMissLockUntil') || 0;
      if (nextAllowedAt > now) return true;

      for (let i = 0; i < players.length; i += 1) {
        const p = players[i];
        if (this.physics.overlap(p, enemy)) return true;
        const dx = enemy.x - p.x;
        const dy = enemy.y - p.y;
        if (dx * dx + dy * dy > radiusSq) continue;

        enemy.setData('nearMissLockUntil', now + NEAR_MISS_COOLDOWN_MS);
        if (now - this.nearMissLastAt <= COMBO_WINDOW_MS) this.nearMissStreak += 1;
        else this.nearMissStreak = 1;
        this.nearMissLastAt = now;

        const nearMissBase = 50 + this.endlessNearMissBonus;
        const gained = this.addScaledScore(nearMissBase + Math.min(24, (this.nearMissStreak - 1) * 6));
        this.showFloatingText(`CLOSE! +${gained}`, enemy.x, enemy.y - 16, {
          color: '#ffbb55',
          size: 16,
          duration: 400,
          scaleFrom: 0.88,
        });
        this.showQuickFlash(0.15, 30);
        this.audio?.playNearMissWhoosh?.();
        this.lastKillAt = now;
        this.updateHud();
        break;
      }
      return true;
    });
  }

  emitEnemyWireframe(enemy, isBoss) {
    const g = this.add.graphics().setDepth(26).setPosition(enemy.x, enemy.y);
    g.lineStyle(2, isBoss ? 0xff99dd : 0xff88cc, 1);
    if (isBoss) {
      const sides = enemy.texture.key === 'boss_hexagon' ? 6 : 5;
      g.beginPath();
      for (let i = 0; i <= sides; i++) {
        const ang = -Math.PI / 2 + ((i % sides) / sides) * Math.PI * 2;
        const px = Math.cos(ang) * 52;
        const py = Math.sin(ang) * 52;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.strokePath();
    } else {
      g.strokeCircle(0, 0, 16);
    }
    this.tweens.add({
      targets: g,
      scale: 2.5,
      alpha: 0,
      duration: 200,
      ease: 'Sine.easeOut',
      onComplete: () => g.destroy(),
    });
  }

  applyHitStop(durationMs, strong = false) {
    if (this.hitStopActive || this.gameOver || this.isChoosingUpgrade) return;
    this.hitStopActive = true;
    this.physics.world.timeScale = 0.02;
    if (this.fireTimer) this.fireTimer.paused = true;
    this.waveManager?.setPaused(true);
    if (strong && this.screenFlash) {
      this.screenFlash.setVisible(true).setAlpha(0.45);
      this.tweens.add({ targets: this.screenFlash, alpha: 0, duration: 140, onComplete: () => this.screenFlash.setVisible(false) });
    }
    this.hitStopRestoreId = setTimeout(() => {
      this.physics.world.timeScale = 1;
      if (this.fireTimer && !this.gameOver && !this.isChoosingUpgrade) this.fireTimer.paused = false;
      if (!this.gameOver && !this.isChoosingUpgrade) this.waveManager?.setPaused(false);
      this.hitStopActive = false;
      this.hitStopRestoreId = null;
    }, durationMs);
  }

  getComboTierInfo(streak = this.killStreak) {
    if (streak >= FEVER_STREAK_THRESHOLD) return { tier: 4, comboLabel: 'x10', scoreMultiplier: 5, color: '#ff66ee' };
    if (streak >= 30) return { tier: 3, comboLabel: 'x5', scoreMultiplier: 3, color: '#ff9f66' };
    if (streak >= 15) return { tier: 2, comboLabel: 'x3', scoreMultiplier: 2, color: '#ffd966' };
    if (streak >= 5) return { tier: 1, comboLabel: 'x2', scoreMultiplier: 1.5, color: '#bbffcc' };
    return { tier: 0, comboLabel: 'x1', scoreMultiplier: 1, color: '#ffe080' };
  }

  getScoreMultiplier() {
    const chainMultiplier = this.feverActive ? 5 : this.comboScoreMultiplier || 1;
    return chainMultiplier * (1 + this.endlessScoreBonus);
  }

  addScaledScore(baseScore) {
    const amount = Math.round(baseScore * this.getScoreMultiplier());
    this.score += amount;
    return amount;
  }

  showQuickFlash(alpha = 0.22, duration = 80) {
    if (!this.screenFlash) return;
    this.screenFlash.setVisible(true).setAlpha(alpha);
    this.tweens.add({
      targets: this.screenFlash,
      alpha: 0,
      duration,
      onComplete: () => this.screenFlash?.setVisible(false),
    });
  }

  showComboTierFlash() {
    const info = this.getComboTierInfo();
    this.showFloatingText(`COMBO ${info.comboLabel.toUpperCase()}!`, this.scale.width * 0.5, 122, {
      color: info.color,
      size: 28,
      duration: 650,
      scaleFrom: 0.72,
    });
    this.showQuickFlash(0.18, 90);
  }

  startFeverMode() {
    this.feverActive = true;
    this.addCoins(50);
    this.feverEndsAt = this.time.now + FEVER_DURATION_MS;
    this.feverActivated = true;
    this.feverCooldownUntil = this.feverEndsAt + FEVER_COOLDOWN_MS;
    this.showFloatingText('FEVER!', this.scale.width * 0.5, this.scale.height * 0.38, {
      color: '#ff77f8',
      size: 48,
      duration: 1000,
      scaleFrom: 0.55,
    });
    this.audio?.playFeverStart?.();
    this.resetFireTimer();
  }

  endFeverMode() {
    if (!this.feverActive) return;
    this.feverActive = false;
    this.feverEndsAt = 0;
    this.resetFireTimer();
  }

  onComboBreak() {
    if (this.killStreak > 1) {
      this.showQuickFlash(0.3, 110);
      this.showFloatingText('COMBO BREAK', this.scale.width * 0.5, 120, {
        color: '#ff6677',
        size: 20,
        duration: 500,
        scaleFrom: 0.85,
      });
      this.audio?.playComboBreak?.();
    }
    this.killStreak = 0;
    this.comboTier = 0;
    this.comboScoreMultiplier = 1;
    this.updateComboHud();
  }

  updateKillStreakOnKill() {
    const now = this.time.now;
    if (this.killStreak > 0 && now - this.lastKillAt <= COMBO_WINDOW_MS) this.killStreak += 1;
    else this.killStreak = 1;
    this.lastKillAt = now;
    this.maxCombo = Math.max(this.maxCombo, this.killStreak);
    const info = this.getComboTierInfo(this.killStreak);
    const didTierUp = info.tier > this.comboTier;
    this.comboTier = info.tier;
    this.comboScoreMultiplier = info.scoreMultiplier;
    if (didTierUp) this.showComboTierFlash();
    if (!this.feverActive && this.killStreak >= FEVER_STREAK_THRESHOLD && now >= this.feverCooldownUntil) this.startFeverMode();
    this.updateComboHud();
    this.audio?.playKillStreakNote(this.killStreak);
  }

  getRunStats() {
    const runDurationMs = Math.max(0, Math.floor(this.time.now - this.runStartMs));
    return {
      score: this.score,
      level: this.currentLevel,
      runKills: this.runKills,
      maxCombo: this.maxCombo,
      runDurationMs,
      selectedUpgrades: [...this.selectedUpgrades],
      coinsCollected: this.coinsCollected,
      feverActivated: this.feverActivated,
      perfectLevels: this.perfectLevels,
    };
  }

  addCoins(amount) {
    const mult = (1 + this.coinBoost * 0.25) * (this.mutators.coinMult || 1);
    const finalAmount = Math.floor(amount * mult);
    this.coinsCollected += finalAmount;
  }

  persistRunStats() {
    const run = this.getRunStats();
    const prev = loadGameProfile();
    const next = {
      ...prev,
      highScore: Math.max(prev.highScore, run.score),
      bestLevel: Math.max(prev.bestLevel, run.level),
      totalGamesPlayed: prev.totalGamesPlayed + 1,
      totalKills: prev.totalKills + run.runKills,
      totalPlayTimeMs: prev.totalPlayTimeMs + run.runDurationMs,
      coins: Math.floor((prev.coins || 0) + run.coinsCollected),
    };

    if (this.challenge) {
      next.dailyChallenges.lastPlayedDate = this.challenge.date;
      next.dailyChallenges.bestScore = Math.max(next.dailyChallenges.bestScore || 0, run.score);
    }

    const newlyUnlocked = checkNewAchievements(run, next);
    if (newlyUnlocked.length > 0) {
      next.achievements = [...(next.achievements || []), ...newlyUnlocked];
      this.showAchievementPopups(newlyUnlocked);
    }

    this.profile = next;
    saveGameProfile(next);
    return { run, profile: next, isNewBest: run.score > prev.highScore };
  }

  showAchievementPopups(ids) {
    ids.forEach((id, i) => {
      this.time.delayedCall(i * 1200, () => {
        this.showFloatingText(`ACHIEVEMENT UNLOCKED!`, this.scale.width * 0.5, 80, {
          color: '#ffd700',
          size: 20,
          duration: 2500,
        });
      });
    });
  }

  formatDuration(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  updateHud() {
    this.hudScore?.setText(`Score: ${this.score}`);
    this.hudLevel?.setText(`LV.${this.currentLevel}`);
    const waveCtx = this.waveManager?.getWaveContext?.();
    if (waveCtx && this.hudWave) {
      const waveNo = Math.max(0, waveCtx.waveIndex + 1);
      this.hudWave.setText(`WAVE ${waveNo}/${waveCtx.totalWaves}`);
    }
    this.layoutTopHud();
    this.updateComboHud();
  }

  updateComboHud() {
    if (!this.hudCombo) return;
    if (this.killStreak > 1) {
      const info = this.getComboTierInfo();
      const left = Math.max(0, COMBO_WINDOW_MS - (this.time.now - this.lastKillAt));
      this.hudCombo.setText(`${info.comboLabel}  STREAK ${this.killStreak}  ${Math.ceil(left / 1000)}s`);
      this.hudCombo.setColor(info.color);
      this.hudCombo.setAlpha(1);
    } else {
      this.hudCombo.setAlpha(0);
    }
  }

  setPlayflowPaused(paused) {
    if (paused) {
      this.physics.pause();
      if (this.fireTimer) this.fireTimer.paused = true;
      this.waveManager?.setPaused(true);
    } else {
      this.physics.resume();
      if (this.fireTimer) this.fireTimer.paused = false;
      this.waveManager?.setPaused(false);
    }
  }

  togglePauseByUser() {
    if (this.gameOver || this.isChoosingUpgrade || this.isGameOverScreenVisible || this.onboardingActive) return;
    this.isPausedByUser = !this.isPausedByUser;
    if (this.isPausedByUser) {
      this.setPlayflowPaused(true);
      this.renderPauseOverlay();
      this.overlayBg.setVisible(true).setAlpha(0.68);
    } else {
      if (this.pauseOverlay) this.pauseOverlay.setVisible(false);
      this.overlayBg.setVisible(false).setAlpha(0);
      this.setPlayflowPaused(false);
      if (this.levelClearPending && !this.gameOver && !this.isChoosingUpgrade) {
        this.time.delayedCall(80, () => this.tryOpenLevelTransition());
      }
    }
  }

  renderPauseOverlay() {
    if (!this.pauseOverlay) return;
    this.pauseOverlay.removeAll(true);
    const { width, height } = this.scale;
    const audioSettings = this.audio?.getSettings?.() || { sfxVolume: 0.85 };
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
        if (this.audio) {
          const settings = this.audio.getSettings();
          saveAudioSettings(settings);
        }
      });
      
      knob.setInteractive({ useHandCursor: true, draggable: true });
      knob.on('drag', (pointer) => {
        update(pointer.worldX);
      });
      
      knob.on('dragend', (pointer) => {
        const settings = this.audio.getSettings();
        saveAudioSettings(settings);
      });

      return [title, bg, fill, knob, pct];
    };

    const sfxSliderItems = createVolumeSlider('SFX', height * 0.455, audioSettings.sfxVolume ?? 0.85, (v) => {
      this.audio?.setSfxVolume(v);
    });

    const resume = makeBtn('Resume', height * 0.56, () => this.togglePauseByUser());
    const restart = makeBtn('Restart', height * 0.635, () => this.scene.restart());
    const menu = makeBtn('Menu', height * 0.71, () => this.scene.start('Menu'));

    this.pauseOverlay.add([panel, title, ...sfxSliderItems, resume, restart, menu]);
    this.pauseOverlay.setVisible(true);
  }

  startOnboarding() {
    if (this.onboardingActive) return;
    this.onboardingActive = true;
    this.onboardingIndex = 0;
    if (this.pauseButton) this.pauseButton.setVisible(false);
    this.setPlayflowPaused(true);
    this.overlayBg.setVisible(true).setAlpha(0.62);
    this.renderOnboardingStep();
  }

  renderOnboardingStep() {
    if (this.onboardingOverlay) this.onboardingOverlay.destroy(true);
    const { width, height } = this.scale;
    const steps = [
      {
        title: 'Move',
        body: 'Drag to move your fleet.',
      },
      {
        title: 'Fire',
        body: 'Your fleet fires automatically.',
      },
      {
        title: 'Dodge',
        body: 'Avoid colliding with enemies. Stay alive.',
      },
    ];
    const step = steps[this.onboardingIndex] || steps[steps.length - 1];
    const container = this.add.container(0, 0).setDepth(245);
    const panel = this.add.rectangle(width * 0.5, height * 0.5, width * 0.82, height * 0.46, 0x0d1320, 0.95).setStrokeStyle(2, 0x66aaff, 0.9);
    const title = this.add
      .text(width * 0.5, height * 0.37, step.title, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '34px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    const body = this.add
      .text(width * 0.5, height * 0.47, step.body, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#d8e8ff',
        align: 'center',
      })
      .setOrigin(0.5);
    const indicator = this.add
      .text(width * 0.5, height * 0.67, `Step ${this.onboardingIndex + 1}/3 — Tap to continue`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#9db2cc',
      })
      .setOrigin(0.5);

    const demoItems = [];
    if (this.onboardingIndex === 0) {
      const arrow = this.add.text(width * 0.5, height * 0.56, '<   >', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '24px',
        color: '#88ddff',
      }).setOrigin(0.5);
      this.tweens.add({ targets: arrow, x: width * 0.5 + 70, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      demoItems.push(arrow);
      this.onboardingArrow = arrow;
    } else if (this.onboardingIndex === 1) {
      const bullet = this.add.image(width * 0.5, height * 0.6, 'bullet').setScale(1.4);
      this.tweens.add({ targets: bullet, y: height * 0.53, alpha: 0.3, duration: 450, repeat: -1 });
      demoItems.push(bullet);
      this.onboardingPreviewBullet = bullet;
    } else {
      const enemy = this.add.image(width * 0.5, height * 0.6, 'enemy').setScale(1.2).setTint(0xff6688);
      this.tweens.add({ targets: enemy, y: height * 0.65, duration: 700, yoyo: true, repeat: -1 });
      demoItems.push(enemy);
      this.onboardingEnemyPreview = enemy;
    }

    container.add([panel, title, body, indicator, ...demoItems]);
    this.onboardingOverlay = container;

    if (this.onboardingTimer) this.onboardingTimer.remove(false);
    this.onboardingTimer = this.time.delayedCall(2000, () => this.advanceOnboarding());
  }

  advanceOnboarding() {
    if (!this.onboardingActive) return;
    this.onboardingIndex += 1;
    if (this.onboardingIndex >= 3) {
      this.onboardingActive = false;
      if (this.onboardingOverlay) {
        this.onboardingOverlay.destroy(true);
        this.onboardingOverlay = null;
      }
      if (this.onboardingTimer) {
        this.onboardingTimer.remove(false);
        this.onboardingTimer = null;
      }
      this.overlayBg.setVisible(false).setAlpha(0);
      this.setPlayflowPaused(false);
      if (this.pauseButton) this.pauseButton.setVisible(true);
      return;
    }
    this.renderOnboardingStep();
  }

  renderGameOverOverlay() {
    if (!this.gameOverOverlay) return;
    this.gameOverOverlay.removeAll(true);
    const { width, height } = this.scale;
    const result = this.gameOverResult || this.persistRunStats();
    const run = result.run;
    const profile = result.profile;
    const upgrades = run.selectedUpgrades.length > 0 ? run.selectedUpgrades.join(', ') : '-';
    const panelWidth = Math.min(width * 0.9, 560);
    const panelHeight = Math.min(height * 0.78, 620);
    const panelX = (width - panelWidth) * 0.5;
    const panelY = Math.max(24, height * 0.1);
    const panelBottom = panelY + panelHeight;

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
        color: '#e6f1ff',
        align: 'center',
        lineSpacing: 6,
        wordWrap: { width: panelWidth - 46 },
      })
      .setOrigin(0.5);

    const retry = this.add
      .text(width * 0.5, panelBottom - 86, 'Tap to Retry', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.restart());

    const menu = this.add
      .text(width * 0.5, panelBottom - 42, 'Menu', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#cce0ff',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('Menu'));

    this.gameOverOverlay.add([panel, title, stats, retry, menu]);
    this.gameOverOverlay.setVisible(true);
  }

  layoutTopHud() {
    if (!this.hudScore || !this.hudLevel || !this.hudWave) return;
    const topY = 18;
    const leftX = 16;
    const gap = 14;
    this.hudScore.setPosition(leftX, topY);
    const levelX = leftX + this.hudScore.width + gap;
    this.hudLevel.setPosition(levelX, topY);
    const waveX = levelX + this.hudLevel.width + gap;
    this.hudWave.setPosition(waveX, topY);
  }

  getCurrentFireDelay() {
    const levelReduction = Math.floor((this.currentLevel - 1) / 2) * 12;
    const upgradeReduction = this.fireRateLevel * 28;
    const scaled = Math.round((BASE_FIRE_MS - levelReduction - upgradeReduction) * this.endlessFireFactor);
    const baseDelay = Math.max(MIN_FIRE_MS, scaled);
    if (!this.feverActive) return baseDelay;
    return Math.max(MIN_FIRE_MS, Math.round(baseDelay / 1.5));
  }

  getCurrentEnemySpawnDelay() {
    return 0;
  }

  tryOpenLevelTransition() {
    if (!this.levelClearPending || this.gameOver) return;
    if (this.isChoosingUpgrade || this.onboardingActive || this.isPausedByUser) return;
    this.openUpgradeSelection();
  }

  getCritChance() {
    return this.critLevel * 0.08;
  }

  getBulletDamage() {
    const base = 1 + this.damageLevel;
    return base * (this.mutators.damageMult || 1);
  }

  canOfferUpgrade(key) {
    const max = UPGRADE_MAX[key];
    if (key === 'triangle') return this.players.getChildren().filter((p) => p.active).length < max;
    if (key === 'fire') return this.fireRateLevel < max;
    if (key === 'damage') return this.damageLevel < max;
    if (key === 'pierce') return this.pierceLevel < max;
    if (key === 'multi') return this.multishotLevel < max;
    if (key === 'crit') return this.critLevel < max;
    if (key === 'frost') return this.frostLevel < max;
    if (key === 'shield') return this.shieldCharges < max;
    if (key === 'endlessOverclock' || key === 'endlessBounty' || key === 'endlessCloseCall') return true;
    return true;
  }

  getUpgradeCurrentValue(key) {
    if (key === 'triangle') return this.players.getChildren().filter((p) => p.active).length;
    if (key === 'fire') return this.fireRateLevel;
    if (key === 'damage') return this.damageLevel;
    if (key === 'pierce') return this.pierceLevel;
    if (key === 'multi') return this.multishotLevel;
    if (key === 'crit') return this.critLevel;
    if (key === 'frost') return this.frostLevel;
    if (key === 'shield') return this.shieldCharges;
    if (key === 'endlessOverclock' || key === 'endlessBounty' || key === 'endlessCloseCall') return this.endlessPicks;
    return 0;
  }

  onLevelCleared() {
    if (!this.tookDamageInLevel) this.perfectLevels += 1;
    this.tookDamageInLevel = false;
    this.startNextLevelFlow();
  }

  startNextLevelFlow() {
    this.levelClearPending = true;
    this.audio?.playLevelUp();
    this.time.delayedCall(LEVEL_CLEAR_RETRY_MS, () => this.tryOpenLevelTransition());
  }

  getStackLabelForCard(def) {
    if (def.repeatable) {
      const cur = this.getUpgradeCurrentValue(def.key);
      return `Lv.${cur} → Lv.${cur + 1}`;
    }
    const max = UPGRADE_MAX[def.key];
    const cur = this.getUpgradeCurrentValue(def.key);
    const next = Math.min(max, cur + 1);
    return `${cur}/${max} → ${next}/${max}`;
  }

  getAvailableUpgradePool(banished = new Set(), excludeKeys = new Set()) {
    const regular = UPGRADE_DEFS.filter(
      (u) => this.canOfferUpgrade(u.key) && !banished.has(u.key) && !excludeKeys.has(u.key),
    );
    if (regular.length > 0) return regular;
    return ENDLESS_UPGRADE_DEFS.filter((u) => !banished.has(u.key) && !excludeKeys.has(u.key));
  }

  pickUpgradeChoices(count, banished = new Set(), excludeKeys = new Set()) {
    const pool = this.getAvailableUpgradePool(banished, excludeKeys);
    const picked = [];

    while (picked.length < count && pool.length > 0) {
      const total = pool.reduce((acc, u) => acc + u.weight, 0);
      let roll = Phaser.Math.Between(1, total);
      let chosenIndex = 0;

      for (let i = 0; i < pool.length; i++) {
        roll -= pool[i].weight;
        if (roll <= 0) {
          chosenIndex = i;
          break;
        }
      }

      picked.push(pool[chosenIndex]);
      pool.splice(chosenIndex, 1);
    }

    return picked;
  }

  pickOneUpgradeExcluding(banished, excludeKeys) {
    let picked = this.pickUpgradeChoices(1, banished, excludeKeys);
    if (picked.length > 0) return picked[0];

    let pool = this.getAvailableUpgradePool(banished, excludeKeys);
    if (pool.length === 0) {
      pool = [...UPGRADE_DEFS, ...ENDLESS_UPGRADE_DEFS].filter((u) => !excludeKeys.has(u.key));
    }
    if (pool.length === 0) return null;

    const total = pool.reduce((acc, u) => acc + u.weight, 0);
    let roll = Phaser.Math.Between(1, total);
    for (let i = 0; i < pool.length; i++) {
      roll -= pool[i].weight;
      if (roll <= 0) return pool[i];
    }
    return pool[0];
  }

  resetFireTimer() {
    if (this.fireTimer) this.fireTimer.remove(false);
    this.fireTimer = this.time.addEvent({
      delay: this.getCurrentFireDelay(),
      loop: true,
      callback: () => this.fireFleet(),
    });
  }

  resetSpawnTimer() {
    // WaveManager controls spawning in Phase 4.
  }

  addPlayerToFleet() {
    const activeCount = this.players.getChildren().filter((p) => p.active).length;
    if (activeCount >= MAX_PLAYER_COUNT) return false;

    const p = this.players.create(this.formationX, this.playerBaseY, 'player');
    p.setCollideWorldBounds(true);
    p.body.setImmovable(true);
    p.body.setAllowGravity(false);
    p.setDepth(10);
    p.setData('offsetX', 0);
    this.relayoutFleet();
    return true;
  }

  relayoutFleet() {
    const activePlayers = this.players.getChildren().filter((p) => p.active);
    const spacing = 36;
    const totalW = Math.max(0, (activePlayers.length - 1) * spacing);
    this.playerHalfSpread = totalW / 2 + 24;
    const selectedColor = this.profile?.cosmetics?.playerColor || 'default';
    const tint = playerTintForLevel(this.currentLevel, selectedColor);

    activePlayers.forEach((p, i) => {
      const ox = -totalW / 2 + i * spacing;
      p.setData('offsetX', ox);
      p.setTint(tint);
      p.setPosition(this.formationX + ox, this.playerBaseY);
      p.body.reset(p.x, p.y);
    });
  }

  getActiveEnemyCount() {
    return this.enemies?.getChildren()?.filter((e) => e.active).length || 0;
  }

  getActiveEnemyBulletCount() {
    return this.enemyBullets?.getChildren()?.filter((b) => b.active).length || 0;
  }

  spawnFromWave(spawn) {
    const config = buildEnemyConfig(spawn.type, this.currentLevel);
    
    // Base difficulty from Shop Upgrades
    let diffMult = 1;
    let spdMult = 1;

    if (this.difficultyOffset > 0) {
      diffMult += (this.difficultyOffset * 0.04);
      spdMult += (this.difficultyOffset * 0.012);
    }

    // Aggressive scaling after Level 10
    if (this.currentLevel > 10) {
      const extraLevels = this.currentLevel - 10;
      // +20% HP and +15% Speed per level after 10 (Multiplicative)
      const escalationHp = Math.pow(1.22, extraLevels);
      const escalationSpd = Math.pow(1.15, extraLevels);
      diffMult *= escalationHp;
      spdMult *= escalationSpd;
    }

    config.hp = Math.max(1, Math.floor(config.hp * diffMult));
    if (config.baseVy) config.baseVy = Math.floor(config.baseVy * spdMult);
    if (config.baseVx) config.baseVx = Math.floor(config.baseVx * spdMult);
    if (config.shieldHp) config.shieldHp = Math.floor(config.shieldHp * diffMult);
    const x = spawn.x ?? Phaser.Math.Between(this.playLeft + 24, this.playRight - 24);
    const y = spawn.y ?? Math.min(this.scale.height * 0.32, 108);
    const sprite = this.enemies.create(x, y, config.texture);
    if (!sprite) return null;

    sprite.setActive(true).setVisible(true);
    sprite.body.setAllowGravity(false);
    sprite.body.reset(x, y);

    const isBoss = Boolean(config.isBoss);
    if (isBoss) {
      sprite.setScale(0.85);
      sprite.setDepth(5);
      sprite.body.setSize(100, 100);
      sprite.body.setOffset(10, 10);
      sprite.setCollideWorldBounds(false);
      sprite.setData('pattern', config.pattern || 0);
    } else {
      sprite.setDepth(4);
      sprite.setCollideWorldBounds(true);
      sprite.setBounce(1, 0);
      sprite.setData('baseVx', spawn.vx ?? config.baseVx ?? 0);
      sprite.setData('baseVy', config.baseVy ?? 45);
      if (config.type === 'tank') sprite.body.setSize(28, 28).setOffset(8, 8);
      else if (config.type === 'splitter' || config.type === 'shieldBearer') sprite.body.setCircle(14, 7, 7);
      else if (config.type === 'splitterMini') sprite.body.setCircle(8, 4, 4);
      else sprite.body.setCircle(15, 5, 5);
      sprite.setVelocity(sprite.getData('baseVx') || 0, sprite.getData('baseVy') || 45);
    }

    sprite.setTint(isBoss ? 0xffffff : enemyColorForLevel(this.currentLevel));
    sprite.setData('isBoss', isBoss);
    sprite.setData('enemyType', config.type);
    sprite.setData('health', config.hp);
    sprite.setData('maxHealth', config.hp);
    sprite.setData('slowUntil', 0);
    sprite.setData('shieldHp', config.shieldHp || 0);
    sprite.setData('splitOnDeath', Boolean(config.splitOnDeath));
    sprite.setData('shrapnelOnDeath', Boolean(config.shrapnelOnDeath));
    sprite.setData('stopY', config.stopY || 0);
    sprite.setData('shootEveryMs', config.shootEveryMs || 0);
    sprite.setData('nextShootAt', this.time.now + Phaser.Math.Between(500, 1300));
    sprite.setData('nextBossAttackAt', this.time.now + Phaser.Math.Between(900, 1300));
    sprite.setData('zigzagAmp', config.zigzagAmp || 0);
    sprite.setData('zigzagFreq', config.zigzagFreq || 0);
    sprite.setData('zigzagSeed', Math.random() * Math.PI * 2);

    const hpTextStyleByType = {
      splitterMini: { size: 9, stroke: 2, yOffset: 0 },
      zigzag: { size: 10, stroke: 2, yOffset: 2 },
      shooter: { size: 10, stroke: 2, yOffset: 0 },
      splitter: { size: 11, stroke: 2, yOffset: 0 },
      shieldBearer: { size: 10, stroke: 2, yOffset: 0 },
      tank: { size: 12, stroke: 3, yOffset: 0 },
      circle: { size: 12, stroke: 3, yOffset: 0 },
    };
    const hpStyle = isBoss
      ? { size: 28, stroke: 4, yOffset: 0 }
      : hpTextStyleByType[config.type] || { size: 11, stroke: 2, yOffset: 0 };

    const txt = this.add
      .text(sprite.x, sprite.y, String(config.hp), {
        fontFamily: 'system-ui, monospace',
        fontSize: `${hpStyle.size}px`,
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setStroke('#000000', hpStyle.stroke);
    sprite.setData('healthText', txt);
    sprite.setData('hpTextYOffset', hpStyle.yOffset || 0);
    return sprite;
  }

  hasActiveBoss() {
    if (!this.enemies) return false;
    let found = false;
    this.enemies.children.iterate((e) => {
      if (e && e.active && e.getData('isBoss')) found = true;
      return !found;
    });
    return found;
  }

  onWaveStarted(ctx, wave) {
    this.hudWave?.setText(`WAVE ${Math.max(1, ctx.waveIndex + 1)}/${ctx.totalWaves}`);
    this.showFloatingText(`WAVE ${Math.max(1, ctx.waveIndex + 1)}/${ctx.totalWaves}`, this.scale.width * 0.5, 92, {
      color: '#bce5ff',
      size: 18,
      duration: 640,
    });
    if (wave?.kind === 'boss') this.triggerBossIntroFx();
  }

  onWaveCleared(ctx) {
    this.addCoins(10);
    this.score += 100;
    this.showFloatingText('WAVE CLEAR +100', this.scale.width * 0.5, 110, {
      color: '#99f1ff',
      size: 20,
      duration: 900,
    });
    this.audio?.playLevelUp?.();
    this.updateHud();
    this.hudWave?.setText(`WAVE ${Math.max(1, ctx.waveIndex + 1)}/${ctx.totalWaves}`);
  }

  onLevelCleared() {
    if (this.levelClearPending || this.gameOver) return;
    this.levelClearPending = true;
    if (!this.tookDamageInLevel) {
      this.perfectLevels += 1;
      this.showFloatingText('PERFECT CLEAR!', this.scale.width * 0.5, this.scale.height * 0.42, {
        color: '#ffd700',
        size: 20,
        duration: 1500,
      });
    }
    this.addCoins(15);
    this.showFloatingText('LEVEL CLEAR!', this.scale.width * 0.5, this.scale.height * 0.35, {
      color: '#ffffff',
      size: 34,
      duration: 1150,
      scaleFrom: 0.7,
    });
    this.triggerLevelUpFx();
    this.pulsePlayfieldFrame();
    this.audio?.playLevelUp?.();
    this.nextLevelFlowRetryAt = this.time.now + 250;
    this.time.delayedCall(780, () => {
      if (!this.gameOver) this.tryOpenLevelTransition();
    });
  }

  startNextLevel() {
    this.currentLevel += 1;
    this.levelClearPending = false;
    this.tookDamageInLevel = false;
    this.nextLevelFlowRetryAt = 0;
    this.relayoutFleet();
    this.resetFireTimer();
    this.waveManager?.startLevel(this.currentLevel);
    this.updateHud();
  }

  pulsePlayfieldFrame() {
    if (this.playfieldPulseTween) this.playfieldPulseTween.remove();
    this.playfieldPulseTween = this.tweens.addCounter({
      from: 2,
      to: 4,
      duration: 150,
      yoyo: true,
      onUpdate: (tw) => {
        this.playfieldPulseWidth = tw.getValue();
        this.drawPlayfieldFrame(this.scale.width, this.scale.height, this.playfieldPulseWidth);
      },
      onComplete: () => {
        this.playfieldPulseWidth = 2;
        this.drawPlayfieldFrame(this.scale.width, this.scale.height, 2);
        this.playfieldPulseTween = null;
      },
    });
  }

  triggerBossIntroFx() {
    const cam = this.cameras.main;
    this.tweens.add({
      targets: cam,
      zoom: 1.02,
      duration: 300,
      yoyo: true,
      ease: 'Sine.easeInOut',
    });
  }

  triggerBossDeathFx() {
    this.showQuickFlash(0.42, 140);
    this.physics.world.timeScale = 0.3;
    this.time.delayedCall(200, () => {
      if (!this.gameOver) this.physics.world.timeScale = 1;
    });
  }

  triggerLevelUpFx() {
    const cam = this.cameras.main;
    this.showQuickFlash(0.22, 120);
    this.tweens.add({
      targets: cam,
      zoom: 1.01,
      duration: 100,
      yoyo: true,
      ease: 'Sine.easeInOut',
    });
  }

  spawnBullet(x, y, vx = 0, kind = 'core') {
    const b = this.bullets.get(x, y, 'bullet');
    if (!b) return;

    b.setActive(true).setVisible(true);
    b.body.reset(x, y);
    b.body.setAllowGravity(false);
    b.body.checkCollision.none = false;
    b.setDepth(8);
    const speedY = this.frostLevel > 0 ? -500 : -470;
    b.setVelocity(vx, speedY);
    const hasPierce = this.pierceLevel > 0 || this.feverActive || this.powerupSystem?.hasPierceBuff?.();
    const kindTint = kind === 'arc' ? 0xff9eff : kind === 'side' ? 0x9db8ff : 0x88ffff;
    const tint = this.frostLevel > 0 ? 0x9feaff : hasPierce ? 0xffd289 : kindTint;
    b.setTint(tint);
    const scaleY = Phaser.Math.Clamp(1 + this.damageLevel * 0.08 + (hasPierce ? 0.08 : 0), 1, 1.45);
    b.setScale(1, scaleY);
    const buffPierce = this.powerupSystem?.hasPierceBuff?.() || this.feverActive ? 99 : 0;
    b.setData('pierceLeft', this.pierceLevel + buffPierce);
    b.setData('bulletKind', kind);
    b.setData('trailAt', 0);
    b.setData('hitLockUntil', 0);
  }

  spawnEnemyBulletAtPlayer(x, y) {
    const player = this.players.getChildren().find((p) => p.active);
    if (!player) return;
    const b = this.enemyBullets.get(x, y, 'bullet');
    if (!b) return;
    const dx = player.x - x;
    const dy = player.y - y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const speed = 220;
    b.setActive(true).setVisible(true);
    b.body.reset(x, y);
    b.body.setAllowGravity(false);
    b.body.checkCollision.none = false;
    b.body.setSize(6, 20);
    b.body.setOffset(0, 0);
    b.setDepth(7);
    b.setTint(0xff5566);
    b.setAlpha(1);
    b.setScale(0.85, 0.95);
    b.setData('isDeathOrb', false);
    b.setData('deathOrbUntil', 0);
    b.setVelocity((dx / len) * speed, (dy / len) * speed);
  }

  spawnEnemyShrapnel(x, y, vx, vy) {
    const b = this.enemyBullets.get(x, y, 'particle_dot');
    if (!b) return;
    const len = Math.max(1, Math.hypot(vx, vy));
    const speed = DEATH_ORB_BASE_SPEED + Phaser.Math.Between(-30, 30);
    const orbUntil = this.time.now + DEATH_ORB_LIFETIME_MS;
    b.setActive(true).setVisible(true);
    b.body.reset(x, y);
    b.body.setAllowGravity(false);
    b.body.checkCollision.none = true;
    b.setDepth(7);
    b.setTint(0xff445a);
    b.setAlpha(0.42);
    b.setScale(1.9);
    b.setCircle(3, 0, 0);
    b.setData('isDeathOrb', true);
    b.setData('deathOrbUntil', orbUntil);
    b.setVelocity((vx / len) * speed, (vy / len) * speed);
    this.time.delayedCall(DEATH_ORB_ARM_DELAY_MS, () => {
      if (b.active && b.getData('isDeathOrb') && b.getData('deathOrbUntil') === orbUntil) {
        b.body.checkCollision.none = false;
        b.setAlpha(0.9);
      }
    });
  }

  spawnEnemyBulletDirectional(x, y, vx, vy, tint = 0xff5b6b, scale = 0.9) {
    const b = this.enemyBullets.get(x, y, 'bullet');
    if (!b) return;
    b.setActive(true).setVisible(true);
    b.body.reset(x, y);
    b.body.setAllowGravity(false);
    b.body.checkCollision.none = false;
    b.body.setSize(6, 20);
    b.body.setOffset(0, 0);
    b.setDepth(7);
    b.setTint(tint);
    b.setAlpha(1);
    b.setScale(scale, scale);
    b.setData('isDeathOrb', false);
    b.setData('deathOrbUntil', 0);
    b.setVelocity(vx, vy);
  }

  fireBossAttackPattern(enemy) {
    if (!enemy?.active) return;
    const pattern = enemy.getData('pattern') || 0;
    const x = enemy.x;
    const y = enemy.y + 26;
    if (pattern === 0) {
      const count = 8;
      const speed = 165 + Math.min(120, this.currentLevel * 7);
      for (let i = 0; i < count; i++) {
        const angle = -Math.PI / 2 + (i / count) * Math.PI * 2;
        this.spawnEnemyBulletDirectional(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 0xff4f8a, 0.92);
      }
      return;
    }
    const player = this.players.getChildren().find((p) => p.active);
    if (!player) return;
    const dx = player.x - x;
    const dy = player.y - y;
    const baseAngle = Math.atan2(dy, dx);
    const spread = 0.22;
    const speed = 245 + Math.min(140, this.currentLevel * 8);
    [-spread, 0, spread].forEach((offset) => {
      const a = baseAngle + offset;
      this.spawnEnemyBulletDirectional(x, y, Math.cos(a) * speed, Math.sin(a) * speed, 0xff5566, 0.95);
    });
  }

  showPickupFlash() {
    if (!this.screenFlash) return;
    this.screenFlash.setVisible(true).setAlpha(0.25);
    this.tweens.add({
      targets: this.screenFlash,
      alpha: 0,
      duration: 130,
      onComplete: () => this.screenFlash?.setVisible(false),
    });
  }

  fireFleet() {
    if (this.gameOver || this.isChoosingUpgrade) return;
    this.audio?.playFire();

    this.players.children.iterate((p) => {
      if (!p || !p.active) return true;

      this.spawnBullet(p.x, p.y - 28, 0, 'core');

      if (this.multishotLevel >= 1) {
        this.spawnBullet(p.x - 10, p.y - 26, -120, 'side');
        this.spawnBullet(p.x + 10, p.y - 26, 120, 'side');
      }

      if (this.multishotLevel >= 2) {
        this.spawnBullet(p.x - 16, p.y - 24, -220, 'arc');
        this.spawnBullet(p.x + 16, p.y - 24, 220, 'arc');
      }

      this.emitMuzzleFlash(p.x, p.y - 30);

      this.tweens.add({
        targets: p,
        scaleX: 1.14,
        scaleY: 1.14,
        duration: 70,
        yoyo: true,
        ease: 'Sine.easeOut',
      });

      return true;
    });
  }

  onBulletHitEnemy(bullet, enemy) {
    if (!bullet.active || !enemy.active || this.gameOver) return;
    const now = this.time.now;
    const hitLockUntil = bullet.getData('hitLockUntil') || 0;
    if (hitLockUntil > now) return;
    bullet.setData('hitLockUntil', now + BULLET_HIT_LOCK_MS);
    const pierceLeft = bullet.getData('pierceLeft') || 0;
    const hasPierceThrough = pierceLeft > 0 || this.powerupSystem?.hasPierceBuff?.() || this.feverActive;
    const kind = bullet.getData('bulletKind') || 'core';

    const crit = Math.random() < this.getCritChance();
    const kindMult = kind === 'arc' ? 0.72 : kind === 'side' ? 0.86 : 1;
    const damage = Math.max(1, Math.round(this.getBulletDamage() * kindMult * (crit ? 2 : 1)));
    this.audio?.playHit();
    if (crit) {
      this.audio?.playCrit();
      this.showQuickFlash(0.18, 50);
    }

    const shieldHp = enemy.getData('shieldHp') || 0;
    if (shieldHp > 0) {
      const sideHit = Math.abs(bullet.x - enemy.x) > 10;
      if (!sideHit && !hasPierceThrough) {
        enemy.setData('shieldHp', Math.max(0, shieldHp - damage));
        this.showFloatingText('BLOCK', enemy.x, enemy.y - 10, { color: '#9feaff', size: 13, duration: 380 });
        this.emitImpactBurst(enemy.x, enemy.y, false);
        this.recycleBullet(bullet);
        return;
      }
    }

    const hp = enemy.getData('health') - damage;
    enemy.setData('health', hp);
    const txt = enemy.getData('healthText');
    if (txt) txt.setText(String(Math.max(0, hp)));

    enemy.setTint(crit ? 0xffffaa : 0xffaaaa);

    let frostApplied = false;
    if (this.frostLevel > 0 && Math.random() < this.frostLevel * 0.18) {
      enemy.setData('slowUntil', this.time.now + 1400 + this.frostLevel * 350);
      frostApplied = true;
    }

    this.emitImpactBurst(enemy.x, enemy.y, crit);
    this.showDamagePopup(enemy.x, enemy.y, damage, crit, frostApplied);

    this.time.delayedCall(70, () => {
      if (enemy.active) enemy.setTint(enemyColorForLevel(this.currentLevel));
    });

    if (hp <= 0) this.killEnemy(enemy);
    if (kind === 'arc' && hp > 0) {
      const splash = Math.max(1, Math.floor(damage * 0.45));
      this.applySplashDamage(enemy, splash);
    }
    if (pierceLeft > 0) {
      const vx = bullet.body.velocity.x;
      const vy = bullet.body.velocity.y;
      bullet.setData('pierceLeft', Math.max(0, pierceLeft - 1));
      bullet.y -= 14;
      bullet.body.reset(bullet.x, bullet.y);
      bullet.setVelocity(vx, vy);
      bullet.body.checkCollision.none = true;
      this.time.delayedCall(BULLET_PIERCE_IFRAME_MS, () => {
        if (bullet.active) bullet.body.checkCollision.none = false;
      });
      if (pierceLeft >= 2) {
        this.showFloatingText(`PIERCE x${pierceLeft}`, bullet.x, bullet.y - 10, {
          color: '#ffd58a',
          size: 10,
          duration: 160,
        });
      }
      bullet.setAlpha(0.9);
      this.time.delayedCall(60, () => {
        if (bullet.active) bullet.setAlpha(1);
      });
      return;
    }
    this.recycleBullet(bullet);
  }

  applySplashDamage(sourceEnemy, splashDamage) {
    const radiusSq = 54 * 54;
    this.enemies.children.iterate((candidate) => {
      if (!candidate || !candidate.active || candidate === sourceEnemy || candidate.getData('isBoss')) return true;
      const dx = candidate.x - sourceEnemy.x;
      const dy = candidate.y - sourceEnemy.y;
      if (dx * dx + dy * dy > radiusSq) return true;
      const hp = (candidate.getData('health') || 1) - splashDamage;
      candidate.setData('health', hp);
      const txt = candidate.getData('healthText');
      if (txt) txt.setText(String(Math.max(0, hp)));
      this.showFloatingText(`-${splashDamage}`, candidate.x, candidate.y - 8, { color: '#ffb2ff', size: 10, duration: 180 });
      if (hp <= 0) this.killEnemy(candidate);
      return true;
    });
  }

  onBulletHitEnemyBullet(playerBullet, enemyBullet) {
    if (!playerBullet.active || !enemyBullet.active) return;
    const pierceLeft = playerBullet.getData('pierceLeft') || 0;
    if (pierceLeft > 0) {
      playerBullet.setData('pierceLeft', Math.max(0, pierceLeft - 1));
      playerBullet.body.checkCollision.none = true;
      this.time.delayedCall(BULLET_PIERCE_IFRAME_MS, () => {
        if (playerBullet.active) playerBullet.body.checkCollision.none = false;
      });
    } else {
      this.recycleBullet(playerBullet);
    }
    this.recycleEnemyBullet(enemyBullet);
    this.emitImpactBurst(enemyBullet.x, enemyBullet.y, false);
  }

  killEnemy(enemy) {
    const x = enemy.x;
    const y = enemy.y;
    const isBoss = enemy.getData('isBoss');
    const type = enemy.getData('enemyType') || 'circle';
    this.updateKillStreakOnKill();
    if (isBoss) {
      this.audio?.playBossDeath();
      this.triggerBossDeathFx();
    } else this.audio?.playEnemyDeath();

    this.sparkle.explode(isBoss ? 28 : 14, x, y);
    this.deathBurst.explode(isBoss ? 36 : 18, x, y);
    if (this.geoBurst) this.geoBurst.explode(isBoss ? 20 : 9, x, y);
    this.emitEnemyWireframe(enemy, isBoss);

    if (enemy.getData('splitOnDeath') && !isBoss) {
      this.spawnFromWave({ type: 'splitterMini', x: x - 12, y: y - 4, vx: -130, spawnDelay: 0 });
      this.spawnFromWave({ type: 'splitterMini', x: x + 12, y: y - 4, vx: 130, spawnDelay: 0 });
    }
    if (enemy.getData('shrapnelOnDeath') && !isBoss) {
      [
        [0, 1],
        [0.62, 0.78],
        [-0.62, 0.78],
        [0.92, 0.38],
        [-0.92, 0.38],
      ].forEach(([vx, vy]) => this.spawnEnemyShrapnel(x, y, vx, vy));
    }

    this.recycleEnemy(enemy);

    const gained = this.addScaledScore(isBoss ? 250 : 10);
    this.addCoins(isBoss ? 25 : 1);
    this.runKills += 1;
    if (!isBoss && type !== 'splitterMini') this.powerupSystem?.maybeDropAt(x, y);
    if (this.getScoreMultiplier() > 1) {
      this.showFloatingText(`+${gained}`, x, y - 10, {
        color: '#ffe082',
        size: isBoss ? 24 : 14,
        duration: 540,
      });
    }
    this.updateHud();
  }

  openUpgradeSelection() {
    if (this.gameOver || this.isChoosingUpgrade || this.onboardingActive || this.isPausedByUser) return;

    this.draftBanishedKeys = new Set();
    this.draftRerollsLeft = DRAFT_REROLLS + this.extraRerolls;
    this.draftChoices = this.pickUpgradeChoices(3, this.draftBanishedKeys, new Set());
    this.fillDraftSlotsToThree();
    if (this.draftChoices.length === 0) {
      // Never allow progression to stall after level clear.
      if (this.levelClearPending) {
        this.showFloatingText('MAX BUILD - NEXT LEVEL', this.scale.width * 0.5, this.scale.height * 0.38, {
          color: '#9fffd3',
          size: 20,
          duration: 900,
        });
        this.time.delayedCall(240, () => {
          if (this.levelClearPending && !this.gameOver) this.startNextLevel();
        });
      }
      return;
    }

    this.isChoosingUpgrade = true;
    if (this.pauseButton) this.pauseButton.setVisible(false);
    if (this.shieldRingG) this.shieldRingG.clear();
    this.clearTransientCombatVisuals();
    this.setPlayflowPaused(true);

    const { width, height } = this.scale;
    this.overlayBg.setVisible(true);
    this.overlayBg.setAlpha(0.52);

    this.renderDraftModal();
  }

  clearTransientCombatVisuals() {
    this.bullets?.children?.iterate((bullet) => {
      if (bullet && bullet.active) this.recycleBullet(bullet);
      return true;
    });
    this.enemyBullets?.children?.iterate((bullet) => {
      if (bullet && bullet.active) this.recycleEnemyBullet(bullet);
      return true;
    });
    this.powerupSystem?.clearActivePickups?.();
  }

  fillDraftSlotsToThree() {
    const target = 3;
    while (this.draftChoices.length < target) {
      const exclude = new Set(this.draftChoices.map((c) => c.key));
      const next = this.pickOneUpgradeExcluding(this.draftBanishedKeys, exclude);
      if (!next) break;
      this.draftChoices.push(next);
    }
  }

  doDraftReroll() {
    if (!this.isChoosingUpgrade || this.draftRerollsLeft <= 0) return;
    this.audio?.playReroll();

    const prev = this.draftChoices.slice();
    this.draftRerollsLeft -= 1;
    this.draftChoices = this.pickUpgradeChoices(3, this.draftBanishedKeys, new Set());
    this.fillDraftSlotsToThree();
    if (this.draftChoices.length === 0) {
      this.draftRerollsLeft += 1;
      this.draftChoices = prev;
    }
    this.renderDraftModal();
  }

  banishDraftSlot(index) {
    if (!this.isChoosingUpgrade || !this.draftChoices[index]) return;
    this.audio?.playBanish();

    const oldKey = this.draftChoices[index].key;
    this.draftBanishedKeys.add(oldKey);

    const exclude = new Set();
    this.draftChoices.forEach((c, j) => {
      if (j !== index) exclude.add(c.key);
    });

    const rep = this.pickOneUpgradeExcluding(this.draftBanishedKeys, exclude);
    if (!rep) {
      this.draftBanishedKeys.delete(oldKey);
      return;
    }

    this.draftChoices[index] = rep;
    this.renderDraftModal();
  }

  renderDraftModal() {
    if (this.upgradeModal) {
      this.upgradeModal.destroy(true);
      this.upgradeModal = null;
    }

    const { width, height } = this.scale;
    const container = this.add.container(0, 0).setDepth(220);

    const title = this.add
      .text(width * 0.5, height * 0.22, 'Draft Upgrade', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const rerollLabel =
      this.draftRerollsLeft > 0 ? `Reroll (${this.draftRerollsLeft})` : 'Reroll (0)';
    const rerollBtn = this.add
      .text(width * 0.5, height * 0.31, rerollLabel, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: this.draftRerollsLeft > 0 ? '#88ffcc' : '#556677',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: this.draftRerollsLeft > 0 });

    if (this.draftRerollsLeft > 0) {
      rerollBtn.on('pointerover', () => rerollBtn.setColor('#ccffee'));
      rerollBtn.on('pointerout', () => rerollBtn.setColor('#88ffcc'));
      rerollBtn.on('pointerdown', () => this.doDraftReroll());
    }

    const hint = this.add
      .text(width * 0.5, height * 0.36, 'Banish removes one card from this draft pool.', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#8899aa',
      })
      .setOrigin(0.5);

    const startX = width * 0.2;
    const gap = width * 0.3;
    const rarityGlow = {
      Common: 0x33cc88,
      Rare: 0x55aaff,
      Epic: 0xaa66ff,
    };
    const cardItems = [];

    this.draftChoices.forEach((choice, i) => {
      const x = startX + i * gap;
      const y = height * 0.54;
      const cardContainer = this.add.container(x, y + 42).setAlpha(0);
      const glow = this.add.rectangle(0, 0, 126, 166, rarityGlow[choice.rarity] || choice.color, 0.12);
      const card = this.add
        .rectangle(0, 0, 112, 152, 0x0f1320, 0.95)
        .setStrokeStyle(2, choice.color, 1)
        .setInteractive({ useHandCursor: true });

      const rarity = this.add
        .text(0, -58, choice.rarity, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '11px',
          color: '#99bbff',
        })
        .setOrigin(0.5);

      const name = this.add
        .text(0, -38, choice.label, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: 100 },
        })
        .setOrigin(0.5);

      const stackLine = this.add
        .text(0, -12, this.getStackLabelForCard(choice), {
          fontFamily: 'ui-monospace, monospace',
          fontSize: '11px',
          color: '#ffeeaa',
        })
        .setOrigin(0.5);

      const desc = this.add
        .text(0, 18, choice.desc, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '11px',
          color: '#bdeeff',
          align: 'center',
          wordWrap: { width: 96 },
        })
        .setOrigin(0.5);

      const banishBtn = this.add
        .text(0, 62, 'Banish', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '12px',
          color: '#ff88aa',
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      banishBtn.on('pointerover', () => banishBtn.setColor('#ffccdd'));
      banishBtn.on('pointerout', () => banishBtn.setColor('#ff88aa'));
      banishBtn.on('pointerdown', () => this.banishDraftSlot(i));

      card.on('pointerover', () => {
        card.setFillStyle(0x171d30, 0.98);
        glow.setAlpha(0.25);
        cardContainer.setScale(1.04);
      });
      card.on('pointerout', () => {
        card.setFillStyle(0x0f1320, 0.95);
        glow.setAlpha(0.12);
        cardContainer.setScale(1);
      });
      card.on('pointerdown', () => this.beginUpgradePick(choice.key, cardContainer, card, glow));

      cardContainer.add([glow, card, rarity, name, stackLine, desc, banishBtn]);
      this.tweens.add({
        targets: cardContainer,
        y,
        alpha: 1,
        duration: 260,
        ease: 'Back.easeOut',
        delay: 60 + i * 60,
      });
      cardItems.push(cardContainer);
    });

    container.add([title, rerollBtn, hint, ...cardItems]);
    this.upgradeModal = container;
    this.upgradePicking = false;
  }

  beginUpgradePick(key, cardContainer, card, glow) {
    if (!this.isChoosingUpgrade || this.upgradePicking) return;
    this.upgradePicking = true;
    card.disableInteractive();
    glow.setAlpha(0.4);
    this.tweens.add({
      targets: cardContainer,
      scaleX: 0.06,
      duration: 90,
      ease: 'Sine.easeIn',
      yoyo: true,
      onComplete: () => this.applyUpgradeChoice(key),
    });
  }

  applyUpgradeChoice(key) {
    if (!this.isChoosingUpgrade) return;
    this.audio?.playUpgradeSelect();

    if (key === 'fire') {
      this.fireRateLevel += 1;
      this.resetFireTimer();
    } else if (key === 'damage') {
      this.damageLevel += 1;
    } else if (key === 'shield') {
      this.shieldCharges = Math.min(5, this.shieldCharges + 1);
    } else if (key === 'triangle') {
      this.addPlayerToFleet();
    } else if (key === 'pierce') {
      this.pierceLevel += 1;
    } else if (key === 'multi') {
      this.multishotLevel += 1;
    } else if (key === 'crit') {
      this.critLevel += 1;
    } else if (key === 'frost') {
      this.frostLevel += 1;
    } else if (key === 'endlessOverclock') {
      this.endlessPicks += 1;
      this.endlessFireFactor = Math.max(0.86, this.endlessFireFactor * 0.99);
      this.resetFireTimer();
    } else if (key === 'endlessBounty') {
      this.endlessPicks += 1;
      this.endlessScoreBonus = Math.min(0.28, this.endlessScoreBonus + 0.012);
    } else if (key === 'endlessCloseCall') {
      this.endlessPicks += 1;
      this.endlessNearMissBonus = Math.min(30, this.endlessNearMissBonus + 3);
    }
    const picked = [...UPGRADE_DEFS, ...ENDLESS_UPGRADE_DEFS].find((u) => u.key === key);
    this.selectedUpgrades.push(picked ? picked.label : key);
    if (picked) this.showFloatingText(`Upgrade Acquired: ${picked.label}`, this.scale.width * 0.5, 120, {
      color: '#88ffd5',
      size: 18,
      duration: 1000,
    });

    if (this.upgradeModal) {
      this.upgradeModal.destroy(true);
      this.upgradeModal = null;
    }

    this.overlayBg.setVisible(false);
    this.overlayBg.setAlpha(0);

    this.isChoosingUpgrade = false;
    this.draftChoices = [];
    this.draftBanishedKeys = new Set();
    this.draftRerollsLeft = 0;
    this.upgradePicking = false;

    this.setPlayflowPaused(false);
    if (this.pauseButton) this.pauseButton.setVisible(true);
    this.updateHud();
    if (this.levelClearPending) this.startNextLevel();
  }

  onPlayerHitEnemy(player, enemy) {
    if (this.gameOver || !enemy.active || this.isChoosingUpgrade) return;

    if (this.shieldCharges > 0) {
      this.shieldFlashIndex = this.shieldCharges - 1;
      this.shieldFlashUntil = this.time.now + 220;
      this.shieldCharges -= 1;
      this.tookDamageInLevel = true;
      this.audio?.playShieldAbsorb();
      this.killEnemy(enemy);
      this.updateHud();
      return;
    }

    this.triggerGameOver(player);
  }

  onPlayerHitEnemyBullet(player, bullet) {
    if (this.gameOver || !bullet.active || this.isChoosingUpgrade) return;
    const isDeathOrb = Boolean(bullet.getData('isDeathOrb'));
    this.recycleEnemyBullet(bullet);
    if (this.shieldCharges > 0) {
      this.shieldFlashIndex = this.shieldCharges - 1;
      this.shieldFlashUntil = this.time.now + 220;
      this.shieldCharges -= 1;
      this.tookDamageInLevel = true;
      this.audio?.playShieldAbsorb();
      if (isDeathOrb) {
        this.showFloatingText('ORB BLOCK', player.x, player.y - 22, { color: '#ff9aa8', size: 12, duration: 340 });
      }
      this.updateHud();
      return;
    }
    if (isDeathOrb) this.showQuickFlash(0.2, 80);
    this.triggerGameOver(player);
  }

  recycleBullet(bullet) {
    this.bullets.killAndHide(bullet);
    bullet.body.stop();
    bullet.body.checkCollision.none = true;
    bullet.clearTint();
    bullet.setScale(1);
    bullet.setAlpha(1);
  }

  recycleEnemyBullet(bullet) {
    this.enemyBullets.killAndHide(bullet);
    bullet.body.stop();
    bullet.body.checkCollision.none = true;
    bullet.body.setSize(6, 20);
    bullet.body.setOffset(0, 0);
    bullet.clearTint();
    bullet.setScale(1);
    bullet.setAlpha(1);
    bullet.setData('isDeathOrb', false);
    bullet.setData('deathOrbUntil', 0);
  }

  recycleEnemy(enemy) {
    const txt = enemy.getData('healthText');
    if (txt) txt.destroy();
    enemy.disableBody(true, true);
    this.enemies.killAndHide(enemy);
  }

  triggerGameOver(playerSprite) {
    this.gameOver = true;
    this.endFeverMode();
    this.killStreak = 0;
    this.comboTier = 0;
    this.comboScoreMultiplier = 1;
    this.audio?.stopAllSfx?.();
    this.audio?.playGameOver();
    if (this.shieldRingG) this.shieldRingG.clear();

    if (this.fireTimer) this.fireTimer.remove(false);
    applyGameOverCombatCleanup(this);

    if (this.upgradeModal) {
      this.upgradeModal.destroy(true);
      this.upgradeModal = null;
    }
    this.overlayBg.setVisible(false);

    this.physics.pause();
    this.cameras.main.shake(500, 0.025);

    const x = playerSprite ? playerSprite.x : this.formationX;
    const y = playerSprite ? playerSprite.y : this.playerBaseY;

    this.deathBurst.explode(48, x, y);
    this.sparkle.explode(32, x, y);

    this.players.children.iterate((p) => {
      if (p && p.active) {
        this.tweens.add({
          targets: p,
          alpha: 0,
          scale: 0.2,
          duration: 400,
          ease: 'Cubic.easeIn',
        });
      }
      return true;
    });

    this.time.delayedCall(420, () => {
      this.gameOverResult = this.persistRunStats();
      this.isGameOverScreenVisible = true;
      if (this.pauseButton) this.pauseButton.setVisible(false);
      this.overlayBg.setVisible(true).setAlpha(0.56);
      this.renderGameOverOverlay();
    });
  }
}
