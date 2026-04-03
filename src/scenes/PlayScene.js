import * as Phaser from 'phaser';

const START_PLAYER_COUNT = 1;
const MAX_PLAYER_COUNT = 6;
const KILLS_PER_LEVEL = 10;
const UPGRADE_INTERVAL_MS = 22000;

const BASE_FIRE_MS = 380;
const MIN_FIRE_MS = 120;
const BASE_ENEMY_SPAWN_MS = 900;
const MIN_ENEMY_SPAWN_MS = 260;

const DRAFT_REROLLS = 2;

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

function playerTintForLevel(level) {
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
  if (level <= 4) return 0.95 + (level - 1) * 0.08;
  if (level <= 10) return 1.19 + (level - 4) * 0.13;
  return 1.97 + (level - 10) * 0.18;
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

  init() {
    this.score = 0;
    this.currentLevel = 1;
    this.killsThisLevel = 0;

    this.formationX = 0;
    this.targetFormationX = 0;
    this.playerHalfSpread = 24;
    this.playerBaseY = 0;

    this.gameOver = false;
    this.isChoosingUpgrade = false;
    this.bossSpawnedForLevel = new Set();

    // Roguelite build state
    this.fireRateLevel = 0;
    this.damageLevel = 0;
    this.shieldCharges = 0;
    this.pierceLevel = 0;
    this.multishotLevel = 0;
    this.critLevel = 0;
    this.frostLevel = 0;

    this.upgradeModal = null;
    this.overlayBg = null;
    this.draftBanishedKeys = new Set();
    this.draftRerollsLeft = 0;
    this.draftChoices = [];

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
    const corners = [
      [this.playLeft + 8, 14],
      [this.playRight - 8, 14],
      [this.playLeft + 8, height - 14],
      [this.playRight - 8, height - 14],
    ];
    corners.forEach(([x, y]) => {
      g.fillStyle(0x66cfff, 0.9);
      g.fillCircle(x, y, 2.6);
      g.fillStyle(0xffffff, 0.4);
      g.fillCircle(x, y, 1.2);
    });
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

    this.hudScore.setPosition(16, 16);

    if (this.overlayBg) {
      this.overlayBg.setPosition(width * 0.5, height * 0.5);
      this.overlayBg.setSize(width, height);
    }

    this.enemies.children.iterate((e) => {
      if (!e || !e.active) return true;
      e.x = Phaser.Math.Clamp(e.x, this.playLeft + 12, this.playRight - 12);
      if (e.body) e.body.reset(e.x, e.y);
      return true;
    });

    if (this.isChoosingUpgrade) this.renderDraftModal();
  }

  create() {
    const { width, height } = this.scale;
    this.ensureStageOneTextures();
    this.createBackgroundLayer(width, height);

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
    this.enemies = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite });

    this.playerBaseY = height - 90;
    this.formationX = width / 2;
    this.targetFormationX = this.formationX;
    this.prevFormationX = this.formationX;
    this.shieldRingG = this.add.graphics().setDepth(12);
    this.screenFlash = this.add
      .rectangle(width * 0.5, height * 0.5, width, height, 0xffffff, 0)
      .setDepth(260)
      .setVisible(false);

    for (let i = 0; i < START_PLAYER_COUNT; i++) this.addPlayerToFleet();

    this.hudScore = this.add
      .text(16, 16, 'Score: 0', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#aaffff',
      })
      .setDepth(100);

    this.overlayBg = this.add
      .rectangle(width * 0.5, height * 0.5, width, height, 0x04050a, 0)
      .setDepth(180)
      .setVisible(false);

    this.physics.add.overlap(this.bullets, this.enemies, this.onBulletHitEnemy, undefined, this);
    this.physics.add.overlap(this.players, this.enemies, this.onPlayerHitEnemy, undefined, this);

    this.resetFireTimer();
    this.resetSpawnTimer();

    this.upgradeTimer = this.time.addEvent({
      delay: UPGRADE_INTERVAL_MS,
      loop: true,
      callback: () => this.openUpgradeSelection(),
    });

    this.input.on('pointermove', (pointer) => {
      if (!this.gameOver && !this.isChoosingUpgrade) this.targetFormationX = pointer.worldX;
    });
    this.input.on('pointerdown', (pointer) => {
      if (!this.gameOver && !this.isChoosingUpgrade) this.targetFormationX = pointer.worldX;
    });

    this.onResize = (gameSize) => this.handleResize(gameSize);
    this.scale.on('resize', this.onResize);
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
    });
  }

  update(_time, delta) {
    this.updateBackgroundFx(delta);
    if (this.gameOver || this.isChoosingUpgrade) return;

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
      if (txt && txt.active) txt.setPosition(e.x, e.y);

      const slowUntil = e.getData('slowUntil') || 0;
      const slowFactor = slowUntil > this.time.now ? 0.6 : 1;

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
      } else {
        const baseVy = e.getData('baseVy') || 45;
        const vy = baseVy * slowFactor;
        e.setVelocityX(e.body.velocity.x);
        e.setVelocityY(vy);
      }
      return true;
    });

    this.bullets.children.iterate((b) => {
      if (b && b.active) {
        if (b.y < -55) this.recycleBullet(b);
        else this.emitBulletTrail(b);
      }
      return true;
    });

    this.enemies.children.iterate((e) => {
      if (e && e.active && e.y > this.scale.height + 95) this.recycleEnemy(e);
      return true;
    });
    this.drawShieldRings();
    this.prevFormationX = this.formationX;
  }

  updateBackgroundFx(delta = 16.6) {
    this.bgTargetTone = backgroundToneForLevel(this.currentLevel);
    this.bgCurrentTone = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(this.bgCurrentTone),
      Phaser.Display.Color.ValueToColor(this.bgTargetTone),
      100,
      4,
    ).color;

    if (this.bgTone) this.bgTone.setFillStyle(this.bgCurrentTone, 0.38);
    if (this.bgGridFar) this.bgGridFar.tilePositionY -= (18 * delta) / 1000;
    if (this.bgGridNear) this.bgGridNear.tilePositionY -= (11 * delta) / 1000;
    if (this.bgGlow) {
      const pulse = 0.03 + (Math.sin(this.time.now * 0.00072) + 1) * 0.025;
      this.bgGlow.setAlpha(pulse);
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

  emitBulletTrail(bullet) {
    if (!this.bulletTrailFx) return;
    const nextAt = bullet.getData('trailAt') || 0;
    if (this.time.now < nextAt) return;
    this.bulletTrailFx.explode(1, bullet.x, bullet.y + 8);
    bullet.setData('trailAt', this.time.now + 34);
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
    if (this.spawnTimer) this.spawnTimer.paused = true;
    if (strong && this.screenFlash) {
      this.screenFlash.setVisible(true).setAlpha(0.45);
      this.tweens.add({ targets: this.screenFlash, alpha: 0, duration: 140, onComplete: () => this.screenFlash.setVisible(false) });
    }
    this.hitStopRestoreId = setTimeout(() => {
      this.physics.world.timeScale = 1;
      if (this.fireTimer && !this.gameOver && !this.isChoosingUpgrade) this.fireTimer.paused = false;
      if (this.spawnTimer && !this.gameOver && !this.isChoosingUpgrade) this.spawnTimer.paused = false;
      this.hitStopActive = false;
      this.hitStopRestoreId = null;
    }, durationMs);
  }

  getCurrentFireDelay() {
    const levelReduction = Math.floor((this.currentLevel - 1) / 2) * 16;
    const upgradeReduction = this.fireRateLevel * 28;
    return Math.max(MIN_FIRE_MS, BASE_FIRE_MS - levelReduction - upgradeReduction);
  }

  getCurrentEnemySpawnDelay() {
    let delay;
    if (this.currentLevel <= 5) delay = BASE_ENEMY_SPAWN_MS - (this.currentLevel - 1) * 45;
    else if (this.currentLevel <= 12) delay = 720 - (this.currentLevel - 5) * 52;
    else delay = 360;
    return Math.max(MIN_ENEMY_SPAWN_MS, Math.floor(delay));
  }

  getCritChance() {
    return this.critLevel * 0.08;
  }

  getBulletDamage() {
    return 1 + this.damageLevel;
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
    return 0;
  }

  getStackLabelForCard(def) {
    const max = UPGRADE_MAX[def.key];
    const cur = this.getUpgradeCurrentValue(def.key);
    const next = Math.min(max, cur + 1);
    return `${cur}/${max} → ${next}/${max}`;
  }

  pickUpgradeChoices(count, banished = new Set(), excludeKeys = new Set()) {
    const pool = UPGRADE_DEFS.filter(
      (u) => this.canOfferUpgrade(u.key) && !banished.has(u.key) && !excludeKeys.has(u.key),
    );
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

    let pool = UPGRADE_DEFS.filter(
      (u) => this.canOfferUpgrade(u.key) && !excludeKeys.has(u.key) && !banished.has(u.key),
    );
    if (pool.length === 0) {
      pool = UPGRADE_DEFS.filter((u) => this.canOfferUpgrade(u.key) && !excludeKeys.has(u.key));
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
    if (this.spawnTimer) this.spawnTimer.remove(false);
    this.spawnTimer = this.time.addEvent({
      delay: this.getCurrentEnemySpawnDelay(),
      loop: true,
      callback: () => this.trySpawnEnemy(),
    });
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
    const tint = playerTintForLevel(this.currentLevel);

    activePlayers.forEach((p, i) => {
      const ox = -totalW / 2 + i * spacing;
      p.setData('offsetX', ox);
      p.setTint(tint);
      p.setPosition(this.formationX + ox, this.playerBaseY);
      p.body.reset(p.x, p.y);
    });
  }

  trySpawnEnemy() {
    if (this.gameOver || this.isChoosingUpgrade) return;
    if (this.hasActiveBoss()) return;

    const spawnMinX = this.playLeft + 26;
    const spawnMaxX = this.playRight - 26;
    const early = this.currentLevel <= 4;
    const hp = early
      ? 1
      : Phaser.Math.Between(1 + Math.floor(this.currentLevel * 0.45), 2 + Math.floor(this.currentLevel * 0.95));

    const count = this.currentLevel < 5 ? 2 : this.currentLevel < 10 ? 3 : 4;
    const speed = enemySpeedMultiplier(this.currentLevel);

    for (let i = 0; i < count; i++) {
      const x = Phaser.Math.Between(spawnMinX, spawnMaxX);
      const y = -40 - i * 34;
      const vy = Phaser.Math.Between(36, 58) * speed;
      const vx = Phaser.Math.Between(-20, 20);
      this.spawnEnemyAt(x, y, hp, false, vy, vx);
    }
  }

  spawnEnemyAt(x, y, health, isBoss, vy, vx = 0) {
    let sprite;

    if (isBoss) {
      const usePentagon = Math.floor(this.currentLevel / 5) % 2 === 1;
      const key = usePentagon ? 'boss_pentagon' : 'boss_hexagon';
      sprite = this.enemies.create(x, y, key);
      sprite.setScale(0.85);
      sprite.setDepth(5);
      sprite.body.setSize(100, 100);
      sprite.body.setOffset(10, 10);
      sprite.setData('isBoss', true);
      sprite.setData('pattern', usePentagon ? 0 : 1);
    } else {
      sprite = this.enemies.create(x, y, 'enemy');
      sprite.setDepth(4);
      sprite.body.setCircle(15, 5, 5);
      sprite.setVelocity(vx, vy);
      sprite.setData('baseVx', vx);
      sprite.setData('baseVy', vy);
      sprite.setCollideWorldBounds(true);
      sprite.setBounce(1, 0);
    }

    sprite.setTint(enemyColorForLevel(this.currentLevel));
    sprite.setData('health', health);
    sprite.setData('maxHealth', health);
    sprite.setData('slowUntil', 0);
    if (isBoss) {
      sprite.setCollideWorldBounds(false);
    }
    sprite.body.setAllowGravity(false);

    const txt = this.add
      .text(sprite.x, sprite.y, String(health), {
        fontFamily: 'system-ui, monospace',
        fontSize: isBoss ? '28px' : '14px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setStroke('#000000', 4);

    sprite.setData('healthText', txt);
    return sprite;
  }

  hasActiveBoss() {
    let found = false;
    this.enemies.children.iterate((e) => {
      if (e && e.active && e.getData('isBoss')) found = true;
      return !found;
    });
    return found;
  }

  maybeSpawnBossForLevel() {
    if (this.currentLevel < 5) return false;
    if (this.currentLevel % 5 !== 0) return false;
    if (this.bossSpawnedForLevel.has(this.currentLevel)) return false;
    if (this.hasActiveBoss()) return false;

    this.bossSpawnedForLevel.add(this.currentLevel);
    const cx = (this.playLeft + this.playRight) * 0.5;
    const hp = 35 + this.currentLevel * 6;
    this.spawnEnemyAt(cx, -88, hp, true, 0, 0);
    return true;
  }

  applyLevelUp() {
    this.currentLevel += 1;
    this.killsThisLevel = 0;

    this.relayoutFleet();
    const bossSpawned = this.maybeSpawnBossForLevel();
    this.resetSpawnTimer();
    this.resetFireTimer();
    this.pulsePlayfieldFrame();
    if (bossSpawned) this.fireFleet();
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

  spawnBullet(x, y, vx = 0) {
    const b = this.bullets.get(x, y, 'bullet');
    if (!b) return;

    b.setActive(true).setVisible(true);
    b.body.reset(x, y);
    b.body.setAllowGravity(false);
    b.body.checkCollision.none = false;
    b.setDepth(8);
    b.setVelocity(vx, -470);
    b.setTint(0x88ffff);
    b.setData('pierceLeft', this.pierceLevel);
    b.setData('trailAt', 0);
  }

  fireFleet() {
    if (this.gameOver || this.isChoosingUpgrade) return;

    this.players.children.iterate((p) => {
      if (!p || !p.active) return true;

      this.spawnBullet(p.x, p.y - 28, 0);

      if (this.multishotLevel >= 1) {
        this.spawnBullet(p.x - 8, p.y - 26, -90);
        this.spawnBullet(p.x + 8, p.y - 26, 90);
      }

      if (this.multishotLevel >= 2) {
        this.spawnBullet(p.x - 14, p.y - 24, -150);
        this.spawnBullet(p.x + 14, p.y - 24, 150);
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

    const crit = Math.random() < this.getCritChance();
    const damage = this.getBulletDamage() * (crit ? 2 : 1);

    const pierceLeft = bullet.getData('pierceLeft') || 0;
    if (pierceLeft <= 0) {
      this.recycleBullet(bullet);
    } else {
      bullet.setData('pierceLeft', pierceLeft - 1);
      bullet.y -= 12;
      bullet.body.reset(bullet.x, bullet.y);
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
  }

  killEnemy(enemy) {
    const x = enemy.x;
    const y = enemy.y;
    const isBoss = enemy.getData('isBoss');

    this.sparkle.explode(isBoss ? 28 : 14, x, y);
    this.deathBurst.explode(isBoss ? 36 : 18, x, y);
    if (this.geoBurst) this.geoBurst.explode(isBoss ? 20 : 9, x, y);
    this.emitEnemyWireframe(enemy, isBoss);
    this.applyHitStop(isBoss ? 150 : 40, isBoss);

    this.recycleEnemy(enemy);

    this.score += isBoss ? 250 : 10;
    this.hudScore.setText(`Score: ${this.score}`);

    this.killsThisLevel += 1;
    if (this.killsThisLevel >= KILLS_PER_LEVEL) this.applyLevelUp();
  }

  openUpgradeSelection() {
    if (this.gameOver || this.isChoosingUpgrade) return;

    this.draftBanishedKeys = new Set();
    this.draftRerollsLeft = DRAFT_REROLLS;
    this.draftChoices = this.pickUpgradeChoices(3, this.draftBanishedKeys, new Set());
    this.fillDraftSlotsToThree();
    if (this.draftChoices.length === 0) return;

    this.isChoosingUpgrade = true;
    if (this.shieldRingG) this.shieldRingG.clear();
    this.physics.pause();
    if (this.fireTimer) this.fireTimer.paused = true;
    if (this.spawnTimer) this.spawnTimer.paused = true;

    const { width, height } = this.scale;
    this.overlayBg.setVisible(true);
    this.overlayBg.setAlpha(0.52);

    this.renderDraftModal();
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
      .text(width * 0.5, height * 0.36, 'Banish = bu draftta bir kartı havuzdan çıkar', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#8899aa',
      })
      .setOrigin(0.5);

    const startX = width * 0.2;
    const gap = width * 0.3;
    const cardItems = [];

    this.draftChoices.forEach((choice, i) => {
      const x = startX + i * gap;
      const y = height * 0.54;

      const card = this.add
        .rectangle(x, y, 112, 152, 0x0f1320, 0.95)
        .setStrokeStyle(2, choice.color, 1)
        .setInteractive({ useHandCursor: true });

      const rarity = this.add
        .text(x, y - 58, choice.rarity, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '11px',
          color: '#99bbff',
        })
        .setOrigin(0.5);

      const name = this.add
        .text(x, y - 38, choice.label, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: 100 },
        })
        .setOrigin(0.5);

      const stackLine = this.add
        .text(x, y - 12, this.getStackLabelForCard(choice), {
          fontFamily: 'ui-monospace, monospace',
          fontSize: '11px',
          color: '#ffeeaa',
        })
        .setOrigin(0.5);

      const desc = this.add
        .text(x, y + 18, choice.desc, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '11px',
          color: '#bdeeff',
          align: 'center',
          wordWrap: { width: 96 },
        })
        .setOrigin(0.5);

      const banishBtn = this.add
        .text(x, y + 62, 'Banish', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '12px',
          color: '#ff88aa',
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      banishBtn.on('pointerover', () => banishBtn.setColor('#ffccdd'));
      banishBtn.on('pointerout', () => banishBtn.setColor('#ff88aa'));
      banishBtn.on('pointerdown', () => this.banishDraftSlot(i));

      card.on('pointerover', () => card.setFillStyle(0x171d30, 0.98));
      card.on('pointerout', () => card.setFillStyle(0x0f1320, 0.95));
      card.on('pointerdown', () => this.applyUpgradeChoice(choice.key));

      cardItems.push(card, rarity, name, stackLine, desc, banishBtn);
    });

    container.add([title, rerollBtn, hint, ...cardItems]);
    this.upgradeModal = container;
  }

  applyUpgradeChoice(key) {
    if (!this.isChoosingUpgrade) return;

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
    }

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

    this.physics.resume();
    if (this.fireTimer) this.fireTimer.paused = false;
    if (this.spawnTimer) this.spawnTimer.paused = false;
  }

  onPlayerHitEnemy(player, enemy) {
    if (this.gameOver || !enemy.active || this.isChoosingUpgrade) return;

    if (this.shieldCharges > 0) {
      this.shieldCharges -= 1;
      this.killEnemy(enemy);
      return;
    }

    this.triggerGameOver(player);
  }

  recycleBullet(bullet) {
    this.bullets.killAndHide(bullet);
    bullet.body.stop();
    bullet.body.checkCollision.none = true;
  }

  recycleEnemy(enemy) {
    const txt = enemy.getData('healthText');
    if (txt) txt.destroy();
    enemy.disableBody(true, true);
    this.enemies.killAndHide(enemy);
  }

  triggerGameOver(playerSprite) {
    this.gameOver = true;
    if (this.shieldRingG) this.shieldRingG.clear();

    if (this.spawnTimer) this.spawnTimer.remove(false);
    if (this.fireTimer) this.fireTimer.remove(false);
    if (this.upgradeTimer) this.upgradeTimer.remove(false);

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

    this.time.delayedCall(1600, () => {
      this.scene.start('Menu');
    });
  }
}
