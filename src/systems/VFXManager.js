export default class VFXManager {
  constructor(scene) {
    this.scene = scene;
  }

  create() {
    this.deathBurst = this.scene.add.particles(0, 0, 'particle_square', {
      speed: { min: 80, max: 320 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 450,
      blendMode: 'ADD',
      emitting: false,
    });

    this.sparkle = this.scene.add.particles(0, 0, 'particle_dot', {
      speed: { min: 40, max: 180 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0 },
      lifespan: 350,
      tint: [0xff66cc, 0x66ffff, 0xffffff],
      blendMode: 'ADD',
      emitting: false,
    });

    this.geoBurst = this.scene.add.particles(0, 0, 'vfx_particle_tri', {
      speed: { min: 70, max: 240 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.75, end: 0 },
      lifespan: 300,
      blendMode: 'ADD',
      emitting: false,
    });

    this.muzzleFx = this.scene.add.particles(0, 0, 'particle_dot', {
      speed: { min: 40, max: 130 },
      angle: { min: -115, max: -65 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [0xffffff, 0x88ffff],
      lifespan: 80,
      blendMode: 'ADD',
      emitting: false,
    });

    this.bulletTrailFx = this.scene.add.particles(0, 0, 'particle_dot', {
      speed: { min: 0, max: 15 },
      scale: { start: 0.45, end: 0 },
      alpha: { start: 0.4, end: 0 },
      tint: [0x88ffff, 0x66e6ff],
      lifespan: 150,
      blendMode: 'ADD',
      emitting: false,
    });

    this.impactFx = this.scene.add.particles(0, 0, 'particle_dot', {
      speed: { min: 40, max: 210 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.75, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xffffff, 0x66ffff, 0xffdd88],
      lifespan: 170,
      blendMode: 'ADD',
      emitting: false,
    });
  }

  explodeDeath(x, y, count = 15) {
    if (this.deathBurst) this.deathBurst.explode(count, x, y);
  }

  explodeSparkle(x, y, count = 12) {
    if (this.sparkle) this.sparkle.explode(count, x, y);
  }
  
  explodeGeo(x, y, count = 10) {
    if (this.geoBurst) this.geoBurst.explode(count, x, y);
  }

  emitMuzzle(x, y, count = 5) {
    if (this.muzzleFx) this.muzzleFx.explode(count, x, y);
  }

  emitTrail(x, y, count = 1) {
    if (this.bulletTrailFx) this.bulletTrailFx.explode(count, x, y);
  }

  emitImpact(x, y, count = 8) {
    if (this.impactFx) this.impactFx.explode(count, x, y);
  }
}
