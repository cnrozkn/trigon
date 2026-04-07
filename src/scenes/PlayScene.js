import * as Phaser from 'phaser';
import { checkNewAchievements } from '../systems/AchievementSystem.js';
import { loadGameProfile, saveGameProfile, saveAudioSettings } from '../utils/Storage.js';
import WaveManager from '../systems/WaveManager.js';
import PowerupSystem from '../systems/PowerupSystem.js';
import VFXManager from '../systems/VFXManager.js';
import CollisionManager from '../systems/CollisionManager.js';
import BackgroundManager from '../systems/BackgroundManager.js';
import { buildEnemyConfig } from '../systems/EnemyFactory.js';
import {
  applyGameOverCombatCleanup,
  computeBulletTrailIntervalMs,
  isGameplayActionPaused,
} from '../systems/combatRuntime.js';

import {
  START_PLAYER_COUNT,
  MAX_PLAYER_COUNT,
  BASE_FIRE_MS,
  MIN_FIRE_MS,
  DRAFT_REROLLS,
  COMBO_WINDOW_MS,
  FEVER_STREAK_THRESHOLD,
  FEVER_DURATION_MS,
  FEVER_COOLDOWN_MS,
  NEAR_MISS_RADIUS_PX,
  NEAR_MISS_COOLDOWN_MS,
  LEVEL_CLEAR_RETRY_MS,
  DEATH_ORB_LIFETIME_MS,
  DEATH_ORB_BASE_SPEED,
  DEATH_ORB_ARM_DELAY_MS,
  BULLET_HIT_LOCK_MS,
  BULLET_PIERCE_IFRAME_MS,
  BOSS_BASE_ATTACK_MS,
  PLAYFIELD_MARGIN,
  BOSS_X_PAD
} from '../data/GameConstants.js';

import {
  UPGRADE_MAX,
  SYNERGY_DEFS,
  UPGRADE_DEFS,
  ENDLESS_UPGRADE_DEFS,
  playerTintForLevel,
  enemyColorForLevel,
  enemySpeedMultiplier,
  regularEnemySpeedMultiplier,
  backgroundToneForLevel,
  getSector
} from '../data/UpgradeDefinitions.js';


export default class PlayScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PlayScene' });
  }

  init(data) {
    this.challenge = data?.challenge || null;
    this.mutators = this.challenge?.mutators || {};
    this.shipClass = data?.shipClass || 'striker';

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

    this.feverThreshold = this.shipClass === 'glitch' ? Math.round(FEVER_STREAK_THRESHOLD * 0.65) : FEVER_STREAK_THRESHOLD;
    this.feverPeriodMult = this.shipClass === 'glitch' ? 0.75 : 1.0;

    if (this.shipClass === 'titan') {
      this.damageLevel += 1;
      this.shieldCharges = this.mutators.noShields ? 0 : this.shieldCharges + 1;
      this.fireRateLevel = -1;
    }
    this.coinBoost = u.coinMultiplier || 0;
    this.extraRerolls = u.extraReroll || 0;
    this.difficultyOffset = Object.values(u).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);

    this.pierceLevel = 0;
    this.multishotLevel = 0;
    this.critLevel = 0;
    this.frostLevel = 0;

    this.synergyFrostNova = 0;
    this.synergyPlasmaBeam = 0;
    this.synergyExplosiveArmor = 0;
    this.nextFrostNovaAt = 0;
    this.nextPlasmaBeamAt = 0;

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

    this.vfx = null;
    this.collisions = null;
    this.background = null;

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
    this.overdriveCharge = 0;
    this.overdriveActive = false;
    this.overdriveUntil = 0;
    this.overdriveUses = 0;
    this.lastTapTime = 0;
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

    this.progressBarBg = null;
    this.powerupBarBg = null;
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

  create() {
    const { width, height } = this.scale;
    this.background = new BackgroundManager(this);
    this.background.create();
    
    this.audio = this.registry.get('audio') || null;
    // Fallback unlock: menu tap should already resume; this covers slow resume or suspended tab.
    if (this.audio && typeof this.audio.resume === 'function') {
      this.input.once('pointerdown', () => {
        void this.audio.resume();
      });
    }
    this.applyPlayfieldWorldBounds(width, height);
    this.vfx = new VFXManager(this);
    this.vfx.create();

    this.collisions = new CollisionManager(this);

    this.players = this.physics.add.group();
    this.bullets = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite, maxSize: 220 });
    this.enemyBullets = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite, maxSize: 260 });
    this.enemies = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite });
    this.blackholes = this.add.group();
    this.nextBlackholeAt = 10000;

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
    this.playfieldFrameG = this.add.graphics().setDepth(200);
    this.drawPlayfieldFrame(width, height, 2);

    const startCount = this.shipClass === 'ghost' ? 2 : START_PLAYER_COUNT;
    for (let i = 0; i < startCount; i++) this.addPlayerToFleet();

    this.physics.add.overlap(this.bullets, this.enemies, this.collisions.onBulletHitEnemy, undefined, this.collisions);
    this.physics.add.overlap(this.players, this.enemies, this.collisions.onPlayerHitEnemy, undefined, this.collisions);
    this.physics.add.overlap(this.players, this.enemyBullets, this.collisions.onPlayerHitEnemyBullet, undefined, this.collisions);
    this.physics.add.overlap(this.bullets, this.enemyBullets, this.collisions.onBulletHitEnemyBullet, undefined, this.collisions);

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
      if (!this.gameOver && !this.isChoosingUpgrade) {
          this.targetFormationX = pointer.worldX;
          const now = this.time.now;
          if (now - (this.lastTapTime || 0) < 250) {
              this.triggerOverdrive();
          }
          this.lastTapTime = now;
      }
    });

    this.scene.launch('UIScene');
    this.game.events.on('save_audio_settings', () => {
      if (this.audio) {
        const settings = this.audio.getSettings();
        saveAudioSettings(settings);
      }
    });

    // Global UI Listeners
    this.game.events.on('select_upgrade', (key) => this.applyUpgradeChoice(key));
    this.game.events.on('reroll_draft', () => this.doDraftReroll());
    this.game.events.on('banish_slot', (index) => this.banishDraftSlot(index));

    this.updateHud();

    if (this.profile.totalGamesPlayed === 0) {
      this.time.delayedCall(200, () => this.startOnboarding());
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('select_upgrade');
      this.game.events.off('reroll_draft');
      this.game.events.off('banish_slot');
      this.game.events.off('save_audio_settings');

      this.scale.off('resize', this.onResize);
      this.background.destroy();
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
    this.background.update(delta, this.currentLevel, this.feverActive, this.shieldCharges, this.gameOver, this.isChoosingUpgrade);
    
    if (this.overdriveActive && this.time.now >= this.overdriveUntil) {
      this.overdriveActive = false;
      this.game.events.emit('update_overdrive', 0, false);
    }
    if (!this.overdriveActive) {
      this.game.events.emit('update_overdrive', this.overdriveCharge / 100, false);
    }

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

    // Bars Update
    const levelProgress = this.waveManager?.getLevelProgress?.() ?? 0;
    const powerupProgress = this.powerupSystem?.getPowerupProgress?.() ?? 0;
    const powerupLabel = this.powerupSystem?.getPowerupLabel?.() ?? '';
    this.game.events.emit('update_bars', levelProgress, powerupProgress, powerupLabel);

    if (this.synergyFrostNova > 0 && this.time.now >= this.nextFrostNovaAt && this.getActiveEnemyCount() > 0) {
      this.triggerFrostNova();
      this.nextFrostNovaAt = this.time.now + 2500;
    }

    if (this.currentLevel >= 5 && !this.levelClearPending && this.time.now >= this.nextBlackholeAt) {
      this.spawnBlackhole();
      this.nextBlackholeAt = this.time.now + Phaser.Math.Between(18000, 26000);
    }
    this.updateBlackholes();

    if (this.time.now >= (this.activeSkillCooldownUntil || 0)) {
       this.game.events.emit('update_skill', 0);
    } else {
       const left = (this.activeSkillCooldownUntil - this.time.now) / 1000;
       this.game.events.emit('update_skill', left);
    }

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
        const hp = e.getData('health') || 0;
        const maxHp = e.getData('maxHealth') || 100;
        const phase2 = hp < maxHp * 0.5;
        
        const nextBossAttackAt = e.getData('nextBossAttackAt') || 0;
        if (this.time.now >= nextBossAttackAt) {
          if (phase2) {
             e.setTint(0xff5555);
             this.time.delayedCall(100, () => { if (e.active) e.setTint(0xffffff); });
          }
          this.fireBossAttackPattern(e, phase2);
          const baseCadence = Math.max(720, BOSS_BASE_ATTACK_MS - this.currentLevel * 26);
          const attackCadence = phase2 ? baseCadence * 0.72 : baseCadence;
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
          if (e.body && (e.body.blocked.left || e.body.blocked.right)) {
            e.setData('zigzagSeed', (e.getData('zigzagSeed') || 0) + Math.PI);
            if (this.vfx) this.vfx.explodeSparkle(e.x, e.y, 6);
          }
          e.setVelocityX(Math.sin((e.getData('zigzagSeed') || 0) + t * freq) * amp * slowMult);
          e.setVelocityY(vy);
        } else if (enemyType === 'teleporter') {
          if (e.body && (e.body.blocked.left || e.body.blocked.right)) {
            const bvx = e.getData('baseVx') || 0;
            e.setData('baseVx', -bvx);
            if (this.vfx) this.vfx.explodeSparkle(e.x, e.y, 6);
          }
          e.setVelocityX((e.getData('baseVx') || 0) * slowMult);
          e.setVelocityY(vy);
          const nextTeleAt = e.getData('nextTeleportAt') || 0;
          if (this.time.now >= nextTeleAt) {
             const basePhaseMs = e.getData('teleportEveryMs') || 3800;
             e.setData('nextTeleportAt', this.time.now + basePhaseMs);
             const targetX = Phaser.Math.Clamp(this.formationX + Phaser.Math.Between(-60, 60), this.playLeft + 24, this.playRight - 24);
             const targetY = e.y + Phaser.Math.Between(40, 80);
             if (targetY < this.scale.height - 120) {
                this.tweens.add({
                   targets: e,
                   alpha: 0.2,
                   scale: 0.3,
                   duration: 150,
                   yoyo: true,
                   onYoyo: () => {
                      e.setPosition(targetX, targetY);
                      this.vfx.explodeSparkle(e.x, e.y, 12);
                   }
                });
             }
          }
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
          if (e.body && (e.body.blocked.left || e.body.blocked.right)) {
            const bvx = e.getData('baseVx') || 0;
            e.setData('baseVx', -bvx);
            if (this.vfx) this.vfx.explodeSparkle(e.x, e.y, 6);
          }
          e.setVelocityX((e.getData('baseVx') || 0) * slowMult);
          e.setVelocityY(vy);
        }
      }
      return true;
    });

    const sector = getSector(this.currentLevel);
    if (!this.gameOver && !isGameplayActionPaused(this)) {
      const dt = delta / 1000;
      const playCenter = this.playLeft + (this.playRight - this.playLeft) * 0.5;
      
      if (sector === 2) {
        // Magnetic Drift
        const drift = Math.sin(this.time.now * 0.0022) * 18;
        this.bullets.children.iterate(b => { if (b && b.active) b.x += drift * dt; });
      } else if (sector === 3) {
        // Gravity Pull
        this.enemies.children.iterate(e => {
          if (e && e.active && !e.getData('isBoss')) {
            e.x += (playCenter - e.x) * 0.45 * dt;
          }
        });
        this.bullets.children.iterate(b => {
          if (b && b.active) {
            b.x += (playCenter - b.x) * 0.25 * dt;
          }
        });
      }
    }

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

  handleResize(gameSize) {
    const width = gameSize.width;
    const height = gameSize.height;

    this.background.handleResize();
    this.applyPlayfieldWorldBounds(width, height);
    this.playerBaseY = height - 90;

    const minX = this.playLeft + this.playerHalfSpread;
    const maxX = this.playRight - this.playerHalfSpread;
    this.formationX = Phaser.Math.Clamp(this.formationX, minX, maxX);
    this.targetFormationX = Phaser.Math.Clamp(this.targetFormationX, minX, maxX);
    this.relayoutFleet();

    if (this.screenFlash) this.screenFlash.setPosition(width * 0.5, height * 0.5).setSize(width, height);
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
    this.vfx.emitMuzzle(x, y, 4);
  }

  emitBulletTrail(bullet, intervalMs = 34) {
    const nextAt = bullet.getData('trailAt') || 0;
    if (this.time.now < nextAt) return;
    this.vfx.emitTrail(bullet.x, bullet.y + 8, 1);
    bullet.setData('trailAt', this.time.now + intervalMs);
  }

  emitImpactBurst(x, y, crit) {
    this.vfx.emitImpact(x, y, crit ? 10 : 5);
    this.vfx.explodeGeo(x, y, crit ? 8 : 4);
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
    this.feverEndsAt = this.time.now + (FEVER_DURATION_MS * this.feverPeriodMult);
    this.feverActivated = true;
    this.feverCooldownUntil = this.feverEndsAt + FEVER_COOLDOWN_MS;
    this.showFloatingText('FEVER!', this.scale.width * 0.5, this.scale.height * 0.38, {
      color: '#ff77f8',
      size: 48,
      duration: 1000,
      scaleFrom: 0.55,
    });
    this.game.events.emit('fever_start');
    this.audio?.playFeverStart?.();
    this.resetFireTimer();
  }

  endFeverMode() {
    if (!this.feverActive) return;
    this.feverActive = false;
    this.feverEndsAt = 0;
    this.game.events.emit('fever_end');
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
    if (!this.feverActive && this.killStreak >= this.feverThreshold && now >= this.feverCooldownUntil) this.startFeverMode();
    this.updateComboHud();
    this.audio?.playKillStreakNote(this.killStreak);
    this.chargeOverdrive(2);
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
      overdriveUses: this.overdriveUses,
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
    this.game.events.emit('update_score', this.score);
    this.game.events.emit('update_level', this.currentLevel);
    const waveCtx = this.waveManager?.getWaveContext?.();
    if (waveCtx) {
      const waveNo = Math.max(0, waveCtx.waveIndex + 1);
      this.game.events.emit('update_wave', waveNo, waveCtx.totalWaves);
    }
  }

  updateComboHud() {
    this.game.events.emit('update_combo', this.killStreak);
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
      this.game.events.emit('show_pause');
    } else {
      this.game.events.emit('hide_pause');
      this.setPlayflowPaused(false);
      if (this.levelClearPending && !this.gameOver && !this.isChoosingUpgrade) {
        this.time.delayedCall(80, () => this.tryOpenLevelTransition());
      }
    }
  }

  // renderPauseOverlay moved to UIScene.js


  startOnboarding() {
    if (this.onboardingActive) return;
    this.onboardingActive = true;
    this.onboardingIndex = 0;
    this.game.events.emit('toggle_ui_visibility', false);
    this.setPlayflowPaused(true);
    this.renderOnboardingStep();
  }

  renderOnboardingStep() {
    const steps = [
      { title: 'Move', body: 'Drag to move your fleet.' },
      { title: 'Fire', body: 'Your fleet fires automatically.' },
      { title: 'Dodge', body: 'Avoid colliding with enemies. Stay alive.' },
    ];
    const step = steps[this.onboardingIndex] || steps[steps.length - 1];
    this.game.events.emit('show_onboarding', { ...step, index: this.onboardingIndex });

    if (this.onboardingTimer) this.onboardingTimer.remove(false);
    this.onboardingTimer = this.time.delayedCall(2000, () => this.advanceOnboarding());
  }

  advanceOnboarding() {
    if (!this.onboardingActive) return;
    this.onboardingIndex += 1;
    if (this.onboardingIndex >= 3) {
      this.onboardingActive = false;
      this.game.events.emit('hide_onboarding');
      this.game.events.emit('toggle_ui_visibility', true);
      if (this.onboardingTimer) {
        this.onboardingTimer.remove(false);
        this.onboardingTimer = null;
      }
      this.setPlayflowPaused(false);
      if (this.pauseButton) this.pauseButton.setVisible(true);
      return;
    }
    this.renderOnboardingStep();
  }

  renderGameOverOverlay() {
    console.log('[PlayScene] Rendering Game Over Overlay');
    const result = this.gameOverResult || this.persistRunStats();
    this.game.events.emit('show_game_over', result);
  }

  // layoutTopHud moved to UIScene.js


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
    if (key === 'synergy_frost_nova') return this.synergyFrostNova < max;
    if (key === 'synergy_plasma_beam') return this.synergyPlasmaBeam < max;
    if (key === 'synergy_explosive_armor') return this.synergyExplosiveArmor < max;
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
    if (key === 'synergy_frost_nova') return this.synergyFrostNova;
    if (key === 'synergy_plasma_beam') return this.synergyPlasmaBeam;
    if (key === 'synergy_explosive_armor') return this.synergyExplosiveArmor;
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
    let regular = UPGRADE_DEFS.filter(
      (u) => this.canOfferUpgrade(u.key) && !banished.has(u.key) && !excludeKeys.has(u.key),
    );
    const availableSynergies = SYNERGY_DEFS.filter(s => {
      if (banished.has(s.key) || excludeKeys.has(s.key) || !this.canOfferUpgrade(s.key)) return false;
      for (const [reqKey, reqVal] of Object.entries(s.requires)) {
         if (this.getUpgradeCurrentValue(reqKey) < reqVal) return false;
      }
      return true;
    });
    regular = regular.concat(availableSynergies);
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
    sprite.setData('bomberExplosionOnDeath', Boolean(config.bomberExplosion));
    sprite.setData('teleportEveryMs', config.teleportEveryMs || 0);
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
    
    // Auto-advance/finish onboarding if it was active to prevent block
    if (this.onboardingActive) {
      this.onboardingIndex = 99;
      this.advanceOnboarding();
    }

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

  drawPlayfieldFrame(width, height, thickness) {
    if (!this.playfieldFrameG) return;
    this.playfieldFrameG.clear();
    const margin = PLAYFIELD_MARGIN;
    const playWidth = width - (margin * 2);

    this.playfieldFrameG.lineStyle(thickness, 0x33eebc, 0.45);
    this.playfieldFrameG.strokeRect(margin, -100, playWidth, height + 200);
    this.playfieldFrameG.setAlpha(0.7);
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
    const isPlasma = kind === 'plasma_beam';
    const kindTint = isPlasma ? 0xff44aa : kind === 'arc' ? 0xff9eff : kind === 'side' ? 0x9db8ff : 0x88ffff;
    const tint = this.frostLevel > 0 ? 0x9feaff : hasPierce ? 0xffd289 : kindTint;
    b.setTint(tint);
    const scaleY = Phaser.Math.Clamp(1 + this.damageLevel * 0.08 + (hasPierce ? 0.08 : 0), 1, 1.45);
    b.setScale(isPlasma ? 3 : 1, isPlasma ? 4 : scaleY);
    if (isPlasma) b.body.setSize(18, 80);
    const buffPierce = this.powerupSystem?.hasPierceBuff?.() || this.feverActive ? 99 : 0;
    b.setData('pierceLeft', isPlasma ? 999 : this.pierceLevel + buffPierce);
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

  fireBossAttackPattern(enemy, phase2 = false) {
    if (!enemy?.active) return;
    const pattern = enemy.getData('pattern') || 0;
    const x = enemy.x;
    const y = enemy.y + 26;
    const speedMult = phase2 ? 1.25 : 1;

    if (pattern === 0) {
      const count = phase2 ? 12 : 8;
      const speed = (165 + Math.min(120, this.currentLevel * 7)) * speedMult;
      for (let i = 0; i < count; i++) {
        const angle = -Math.PI / 2 + (i / count) * Math.PI * 2;
        this.spawnEnemyBulletDirectional(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, phase2 ? 0xff3344 : 0xff4f8a, 0.92);
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

  spawnBlackhole() {
    const rx = Phaser.Math.Between(this.playLeft + 60, this.playRight - 60);
    const ry = Phaser.Math.Between(120, this.scale.height - 280);
    const bh = this.add.sprite(rx, ry, 'blackhole').setDepth(5).setScale(0).setAlpha(0);
    this.blackholes.add(bh);
    bh.setData('diesAt', this.time.now + 9000);
    this.tweens.add({ targets: bh, scale: 1, alpha: 0.8, duration: 600, ease: 'Back.easeOut' });
    this.showFloatingText('GRAVITY ANOMALY', rx, ry - 50, { color: '#aa33ff', size: 14, duration: 1500 });
  }

  updateBlackholes() {
    const now = this.time.now;
    this.blackholes.children.iterate((bh) => {
      if (bh && bh.active) {
        bh.rotation += 0.04;
        if (now > bh.getData('diesAt') && !bh.getData('dying')) {
          bh.setData('dying', true);
          this.tweens.add({ targets: bh, scale: 0, alpha: 0, duration: 400, onComplete: () => bh.destroy() });
        } else if (!bh.getData('dying')) {
          // Pull player
          const dx = bh.x - this.targetFormationX;
          const dy = bh.y - this.playerBaseY;
          const dist = Math.max(1, Math.hypot(dx, dy));
          if (dist < 260) {
            const force = (260 - dist) / 260; // 0 to 1
            this.targetFormationX += (dx / dist) * force * 1.5;
          }
          // Pull bullets
          this.bullets.children.iterate((b) => {
             if (b && b.active) {
                const bdx = bh.x - b.x;
                const bdy = bh.y - b.y;
                const bdist = Math.max(1, Math.hypot(bdx, bdy));
                if (bdist < 260) {
                   const bforce = (260 - bdist) / 260;
                   b.x += (bdx / bdist) * bforce * 4.5;
                   b.y += (bdy / bdist) * bforce * 2.5; 
                   if (bdist < 20) {
                      this.recycleBullet(b);
                      this.emitMuzzleFlash(bh.x, bh.y);
                   }
                }
             }
             return true;
          });
        }
      }
      return true;
    });
  }


  triggerFrostNova() {
    if (this.gameOver || this.isChoosingUpgrade) return;
    this.audio?.playFire();
    this.showFloatingText('FROST NOVA', this.formationX, this.playerBaseY - 40, { color: '#66e6ff', size: 14, duration: 500 });
    this.showQuickFlash(0.2, 100);
    for(let i=0; i<16; i++) {
        const angle = (i/16) * Math.PI*2;
        const vx = Math.cos(angle) * 350;
        const vy = Math.sin(angle) * 350;
        const b = this.bullets.get(this.formationX, this.playerBaseY, 'bullet');
        if (b) {
           b.setActive(true).setVisible(true);
           b.body.reset(this.formationX, this.playerBaseY);
           b.body.setAllowGravity(false);
           b.body.checkCollision.none = false;
           b.setVelocity(vx, vy);
           b.setTint(0x9feaff);
           b.setScale(1.2, 1.2);
           b.setData('pierceLeft', 2);
           b.setData('bulletKind', 'frost_nova');
           b.setData('hitLockUntil', 0);
        }
    }
  }

  triggerExplosiveArmor() {
    this.showFloatingText('EXPLOSIVE ARMOR', this.formationX, this.playerBaseY - 30, { color: '#ffaacc', size: 18, duration: 600 });
    this.showQuickFlash(0.4, 200);
    this.enemies.children.iterate((e) => {
       if (e && e.active) {
           const dist = Phaser.Math.Distance.Between(this.formationX, this.playerBaseY, e.x, e.y);
           if (dist < 320) {
              const damage = 8 + this.damageLevel * 3;
              const hp = e.getData('health') - damage;
              e.setData('health', hp);
              const txt = e.getData('healthText');
              if (txt) txt.setText(String(Math.max(0, hp)));
              e.setTint(0xffaaaa);
              if (hp <= 0) this.killEnemy(e);
           }
       }
       return true;
    });
  }

  fireFleet() {
    if (this.gameOver || this.isChoosingUpgrade) return;
    this.audio?.playFire();

    this.players.children.iterate((p) => {
      if (!p || !p.active) return true;

      if (this.synergyPlasmaBeam > 0) {
        this.spawnBullet(p.x, p.y - 40, 0, 'plasma_beam');
      } else {
        this.spawnBullet(p.x, p.y - 28, 0, 'core');
      }

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

  // Combat & Economy Helpers
  addCoins(amount) {
    if (this.gameOver) return;
    this.coinsCollectedInRun = (this.coinsCollectedInRun || 0) + amount;
    this.audio?.playCoin?.();
    this.updateHud();
  }

  addScaledScore(base) {
    const gained = Math.round(base * this.getScoreMultiplier());
    this.score += gained;
    this.updateHud();
    return gained;
  }

  emitImpactBurst(x, y, crit) {
    this.vfx?.emitImpactBurst?.(x, y, crit);
  }

  showDamagePopup(x, y, damage, crit, frost) {
    const label = frost ? `FROZEN ${damage}` : (crit ? `CRIT ${damage}` : `${damage}`);
    if (crit) this.showFloatingText('+CRIT', x, y - 14, { color: '#ffdd77', size: 20, duration: 520 });
    this.showFloatingText(label, x, y - 8, {
       color: frost ? '#bce5ff' : (crit ? '#ffdd77' : '#ffffff'),
       size: crit ? 18 : 12,
       duration: 450,
       scaleFrom: 0.8
    });
  }

  applySplashDamage(enemy, damage) {
    const radius = 64;
    this.enemies.children.iterate((e) => {
      if (e && e.active && e !== enemy) {
        const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, e.x, e.y);
        if (dist <= radius) {
          const hp = e.getData('hp') - damage;
          e.setData('hp', hp);
          e.setTint(0xff5566);
          this.time.delayedCall(80, () => {
            if (e.active) e.setTint(enemyColorForLevel(this.currentLevel));
          });
          this.showDamagePopup(e.x, e.y, damage, false, false);
          if (hp <= 0) this.killEnemy(e);
        }
      }
      return true;
    });
  }

  // Collision handlers moved to CollisionManager.js

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

    this.vfx.explodeSparkle(x, y, isBoss ? 28 : 14);
    this.vfx.explodeDeath(x, y, isBoss ? 36 : 18);
    this.vfx.explodeGeo(x, y, isBoss ? 20 : 9);
    this.emitEnemyWireframe(enemy, isBoss);

    if (enemy.getData('splitOnDeath') && !isBoss) {
      this.spawnFromWave({ type: 'splitterMini', x: x - 12, y: y - 4, vx: -130, spawnDelay: 0 });
      this.spawnFromWave({ type: 'splitterMini', x: x + 12, y: y - 4, vx: 130, spawnDelay: 0 });
    }
    if (enemy.getData('bomberExplosionOnDeath') && !isBoss) {
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        this.spawnEnemyShrapnel(x, y, Math.cos(angle), Math.sin(angle));
      }
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
      if (this.levelClearPending) {
        this.showFloatingText('MAX BUILD - NEXT LEVEL', this.scale.width * 0.5, this.scale.height * 0.38, {
          color: '#9fffd3', size: 20, duration: 900,
        });
        this.time.delayedCall(240, () => {
          if (this.levelClearPending && !this.gameOver) this.startNextLevel();
        });
      }
      return;
    }

    this.isChoosingUpgrade = true;
    if (this.pauseButton) this.pauseButton.setVisible(false);
    this.setPlayflowPaused(true);

    console.log('[PlayScene] Opening Upgrade Selection with choices:', this.draftChoices.length);
    console.log('[PlayScene] Opening Upgrade Selection with choices:', this.draftChoices.length);
    this.game.events.emit('show_upgrade_selection', {
      choices: this.draftChoices.map(c => ({ ...c, stackLabel: this.getStackLabelForCard(c) })),
      rerolls: this.draftRerollsLeft,
      extraRerolls: this.extraRerolls
    });
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
    this.audio?.playReroll?.();
    this.draftRerollsLeft -= 1;
    
    const currentKeys = new Set(this.draftChoices.map(c => c.key));
    this.draftChoices = this.pickUpgradeChoices(3, this.draftBanishedKeys, currentKeys);
    this.fillDraftSlotsToThree();
    
    this.game.events.emit('update_upgrade_selection', {
      choices: this.draftChoices.map(c => ({ ...c, stackLabel: this.getStackLabelForCard(c) })),
      rerolls: this.draftRerollsLeft
    });
  }

  banishDraftSlot(index) {
    if (!this.isChoosingUpgrade || !this.draftChoices[index]) return;
    this.audio?.playBanish?.();

    const oldKey = this.draftChoices[index].key;
    this.draftBanishedKeys.add(oldKey);

    const exclude = new Set(this.draftChoices.map(c => c.key));
    const rep = this.pickOneUpgradeExcluding(this.draftBanishedKeys, exclude);
    
    if (rep) {
      this.draftChoices[index] = rep;
    } else {
      this.draftChoices.splice(index, 1);
      this.fillDraftSlotsToThree();
    }

    this.game.events.emit('update_upgrade_selection', {
      choices: this.draftChoices.map(c => ({ ...c, stackLabel: this.getStackLabelForCard(c) })),
      rerolls: this.draftRerollsLeft
    });
  }

  applyUpgradeChoice(key) {
    if (!this.isChoosingUpgrade) return;
    this.audio?.playUpgradeSelect?.();

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
    } else if (key === 'synergy_frost_nova') {
      this.synergyFrostNova = 1;
    } else if (key === 'synergy_plasma_beam') {
      this.synergyPlasmaBeam = 1;
    } else if (key === 'synergy_explosive_armor') {
      this.synergyExplosiveArmor = 1;
    }

    const picked = [...UPGRADE_DEFS, ...ENDLESS_UPGRADE_DEFS, ...SYNERGY_DEFS].find((u) => u.key === key);
    this.selectedUpgrades.push(picked ? picked.label : key);
    
    this.isChoosingUpgrade = false;
    this.draftChoices = [];
    this.draftBanishedKeys = new Set();
    this.draftRerollsLeft = 0;
    this.upgradePicking = false;

    this.setPlayflowPaused(false);
    this.updateHud();
    this.game.events.emit('close_upgrade_selection');
    if (this.levelClearPending) this.startNextLevel();
  }

  // Player collision handlers moved to CollisionManager.js

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

  chargeOverdrive(amount) {
    if (this.overdriveActive || this.gameOver) return;
    this.overdriveCharge = Math.min(100, this.overdriveCharge + amount);
    this.game.events.emit('update_overdrive', this.overdriveCharge / 100, false);
  }

  triggerOverdrive() {
    if (this.overdriveCharge < 100 || this.overdriveActive || this.gameOver) return;
    
    this.overdriveUses++;
    this.overdriveActive = true;
    this.overdriveUntil = this.time.now + 4500; // 4.5 seconds
    this.overdriveCharge = 0;
    
    this.game.events.emit('update_overdrive', 0, true);
    this.audio?.playUpgradeSelect?.(); 
    this.showQuickFlash(0.25, 120);
    this.vfx?.explodeSparkle(this.formationX, this.playerBaseY, 24);
    this.showFloatingText('OVERDRIVE!', this.scale.width * 0.5, this.scale.height * 0.45, { color: '#00ffcc', size: 38, duration: 1000 });

    if (this.shipClass === 'titan') {
      this.triggerPhalanx();
    } else if (this.shipClass === 'ghost') {
      this.triggerPhantomFleet();
    } else if (this.shipClass === 'glitch') {
      this.triggerChronoStatic();
    } else {
      this.triggerNovaBurst(); // Striker or default
    }
  }

  triggerNovaBurst() {
    // Striker: 360 degree 24-bullet burst
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const b = this.bullets.get(this.formationX, this.playerBaseY, 'bullet');
      if (b) {
        b.setActive(true).setVisible(true);
        b.body.reset(this.formationX, this.playerBaseY);
        b.body.setAllowGravity(false);
        b.setData('bulletKind', 'nova');
        b.setDepth(8);
        b.setTint(0x88ffff);
        this.physics.velocityFromRotation(angle, 400, b.body.velocity);
      }
    }
    // Repeat once after 0.5s
    this.time.delayedCall(500, () => {
      if (this.overdriveActive) this.triggerNovaBurst();
    });
  }

  triggerPhalanx() {
    // Titan: Invincibility + Shield Ring for 5s
    const originalShields = this.shieldCharges;
    this.shieldCharges = Math.max(this.shieldCharges, 3);
    this.showFloatingText('PHALANX ACTIVE', this.formationX, this.playerBaseY - 40);
    this.time.delayedCall(4500, () => {
      this.overdriveActive = false;
      this.game.events.emit('update_overdrive', 0, false);
    });
  }

  triggerPhantomFleet() {
    // Ghost: Spawn 4 temporary mini-ships
    for (let i = 0; i < 4; i++) {
        const ox = (i - 1.5) * 45;
        this.time.delayedCall(i * 100, () => {
            const p = this.players.get(this.formationX + ox, this.playerBaseY + 20);
            if (p) {
               p.setActive(true).setVisible(true).setAlpha(0.6).setScale(0.7);
               p.setData('isPhantom', true);
               this.time.delayedCall(4000, () => {
                   if (p.active) {
                       this.vfx.explodeSparkle(p.x, p.y, 8);
                       p.setActive(false).setVisible(false);
                   }
               });
            }
        });
    }
  }

  triggerChronoStatic() {
    // Glitch: Global time slow for 4s
    this.powerupSystem?.forceGlobalSlow?.(0.3, 4000);
    this.showFloatingText('TIME GLITCH', this.scale.width * 0.5, this.scale.height * 0.2);
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
    this.game.events.emit('close_upgrade_selection');
    this.game.events.emit('hide_onboarding');
    this.overlayBg?.setVisible(false);

    this.physics.pause();
    this.cameras.main.shake(500, 0.025);

    const x = playerSprite ? playerSprite.x : this.formationX;
    const y = playerSprite ? playerSprite.y : this.playerBaseY;

    this.vfx.explodeDeath(x, y, 48);
    this.vfx.explodeSparkle(x, y, 32);

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
      this.renderGameOverOverlay();
    });
  }
}
