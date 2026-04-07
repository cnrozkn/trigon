import * as Phaser from 'phaser';

function drawRegularPolygon(graphics, cx, cy, radius, sides, fillColor, lineColor, lineWidth) {
  graphics.fillStyle(fillColor, 1);
  graphics.lineStyle(lineWidth, lineColor, 1);
  graphics.beginPath();
  for (let i = 0; i <= sides; i++) {
    const angle = -Math.PI / 2 + ((i % sides) / sides) * Math.PI * 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) {
      graphics.moveTo(x, y);
    } else {
      graphics.lineTo(x, y);
    }
  }
  graphics.closePath();
  graphics.fillPath();
  graphics.strokePath();
}

export default class Boot extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' });
  }

  create() {
    const mk = (w, h) =>
      this.make.graphics({ x: 0, y: 0, add: false });

    // Player triangle (neon outline + fill)
    {
      const g = mk(48, 48);
      const cx = 24;
      const cy = 30;
      g.fillStyle(0xffffff, 1);
      g.lineStyle(2, 0xaaffff, 1);
      g.beginPath();
      g.moveTo(cx, cy - 18);
      g.lineTo(cx - 16, cy + 14);
      g.lineTo(cx + 16, cy + 14);
      g.closePath();
      g.fillPath();
      g.strokePath();
      g.generateTexture('player', 48, 48);
      g.destroy();
    }

    // Bullet — thin neon bar
    {
      const g = mk(6, 20);
      g.fillStyle(0x88ffff, 1);
      g.fillRoundedRect(1, 0, 4, 20, 2);
      g.generateTexture('bullet', 6, 20);
      g.destroy();
    }

    // Enemy circle ring (smaller, denser waves)
    {
      const g = mk(40, 40);
      g.lineStyle(3, 0xff66aa, 1);
      g.strokeCircle(20, 20, 15);
      g.lineStyle(1, 0xffaaee, 0.6);
      g.strokeCircle(20, 20, 12);
      g.generateTexture('enemy_circle', 40, 40);
      g.destroy();
    }

    // Enemy: zigzag runner (inverted neon triangle)
    {
      const g = mk(40, 40);
      g.fillStyle(0x2a1200, 0.95);
      g.lineStyle(2.5, 0xffa34d, 1);
      g.beginPath();
      g.moveTo(20, 32);
      g.lineTo(8, 10);
      g.lineTo(32, 10);
      g.closePath();
      g.fillPath();
      g.strokePath();
      g.generateTexture('enemy_zigzag', 40, 40);
      g.destroy();
    }

    // Enemy: tank (neon square)
    {
      const g = mk(44, 44);
      g.fillStyle(0x1a2b0f, 0.95);
      g.fillRoundedRect(8, 8, 28, 28, 4);
      g.lineStyle(3, 0xc8ff55, 1);
      g.strokeRoundedRect(8, 8, 28, 28, 4);
      g.lineStyle(1, 0xe6ff99, 0.8);
      g.strokeRoundedRect(11, 11, 22, 22, 3);
      g.generateTexture('enemy_tank', 44, 44);
      g.destroy();
    }

    // Enemy: splitter (diamond)
    {
      const g = mk(42, 42);
      g.fillStyle(0x220f38, 0.95);
      g.lineStyle(2.5, 0xbb77ff, 1);
      g.beginPath();
      g.moveTo(21, 5);
      g.lineTo(37, 21);
      g.lineTo(21, 37);
      g.lineTo(5, 21);
      g.closePath();
      g.fillPath();
      g.strokePath();
      g.generateTexture('enemy_splitter', 42, 42);
      g.destroy();
    }

    // Enemy: splitter mini
    {
      const g = mk(24, 24);
      g.fillStyle(0x2a1850, 0.95);
      g.lineStyle(1.8, 0xd8a7ff, 1);
      g.beginPath();
      g.moveTo(12, 4);
      g.lineTo(20, 12);
      g.lineTo(12, 20);
      g.lineTo(4, 12);
      g.closePath();
      g.fillPath();
      g.strokePath();
      g.generateTexture('enemy_splitter_mini', 24, 24);
      g.destroy();
    }

    // Enemy: shooter (hexagon)
    {
      const g = mk(40, 40);
      drawRegularPolygon(g, 20, 20, 14, 6, 0x2c0f14, 0xff5566, 2.5);
      g.generateTexture('enemy_shooter', 40, 40);
      g.destroy();
    }

    // Enemy: bomber (octagon or spikey circle)
    {
      const g = mk(44, 44);
      g.fillStyle(0x360f0f, 0.95);
      g.lineStyle(2.5, 0xff4422, 1);
      drawRegularPolygon(g, 22, 22, 16, 8, 0x360f0f, 0xff4422, 2.5);
      g.lineStyle(1.5, 0xff8866, 0.6);
      g.strokeCircle(22, 22, 8);
      g.generateTexture('enemy_bomber', 44, 44);
      g.destroy();
    }

    // Enemy: teleporter (diamond with cross in it)
    {
      const g = mk(40, 40);
      g.fillStyle(0x0f2a36, 0.95);
      g.lineStyle(2, 0x66ccff, 1);
      g.beginPath();
      g.moveTo(20, 4);
      g.lineTo(36, 20);
      g.lineTo(20, 36);
      g.lineTo(4, 20);
      g.closePath();
      g.fillPath();
      g.strokePath();
      g.lineStyle(1.5, 0x33ffff, 0.8);
      g.strokeLineShape(new Phaser.Geom.Line(20, 6, 20, 34));
      g.strokeLineShape(new Phaser.Geom.Line(6, 20, 34, 20));
      g.generateTexture('enemy_teleporter', 40, 40);
      g.destroy();
    }

    // Enemy: shield bearer (pentagon + aura ring)
    {
      const g = mk(44, 44);
      drawRegularPolygon(g, 22, 22, 13, 5, 0x0f2436, 0x66eaff, 2.5);
      g.lineStyle(1.6, 0x99f7ff, 0.9);
      g.strokeCircle(22, 22, 18);
      g.generateTexture('enemy_shield_bearer', 44, 44);
      g.destroy();
    }

    // Blackhole (swirling dark circle)
    {
      const g = mk(80, 80);
      g.fillStyle(0x0a0515, 0.95);
      g.fillCircle(40, 40, 36);
      g.lineStyle(2, 0x551188, 1);
      g.strokeCircle(40, 40, 36);
      g.lineStyle(2, 0x8822cc, 0.7);
      g.beginPath();
      g.arc(40, 40, 24, 0, Math.PI, false);
      g.strokePath();
      g.lineStyle(1.5, 0xff55ff, 0.5);
      g.beginPath();
      g.arc(40, 40, 12, Math.PI, Math.PI * 2, false);
      g.strokePath();
      g.generateTexture('blackhole', 80, 80);
      g.destroy();
    }

    // Particle shards
    {
      const g = mk(8, 8);
      g.fillStyle(0xff88ee, 1);
      g.fillRect(1, 1, 6, 6);
      g.generateTexture('particle_square', 8, 8);
      g.destroy();
    }
    {
      const g = mk(6, 6);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(3, 3, 2.5);
      g.generateTexture('particle_dot', 6, 6);
      g.destroy();
    }
    {
      const g = mk(12, 12);
      g.fillStyle(0xffffff, 1);
      g.beginPath();
      g.moveTo(6, 0);
      g.lineTo(12, 12);
      g.lineTo(0, 12);
      g.closePath();
      g.fillPath();
      g.generateTexture('vfx_particle_tri', 12, 12);
      g.destroy();
    }

    // Power-up: shield icon (ring + center dot)
    {
      const g = mk(36, 36);
      g.fillStyle(0x10243a, 0.95);
      g.fillCircle(18, 18, 14);
      g.lineStyle(2.5, 0x66ccff, 1);
      g.strokeCircle(18, 18, 14);
      g.lineStyle(1.5, 0xaaddee, 1);
      g.strokeCircle(18, 18, 10);
      g.fillStyle(0x9fe4ff, 1);
      g.fillCircle(18, 18, 2.5);
      g.generateTexture('powerup_shield', 36, 36);
      g.destroy();
    }

    // Power-up: piercing icon (arrow)
    {
      const g = mk(36, 36);
      g.fillStyle(0x3a2a10, 0.95);
      g.fillCircle(18, 18, 14);
      g.lineStyle(2.5, 0xffcc66, 1);
      g.strokeCircle(18, 18, 14);
      g.fillStyle(0xffdd88, 1);
      g.beginPath();
      g.moveTo(9, 18);
      g.lineTo(22, 18);
      g.lineTo(22, 13);
      g.lineTo(29, 18);
      g.lineTo(22, 23);
      g.lineTo(22, 18);
      g.closePath();
      g.fillPath();
      g.generateTexture('powerup_pierce', 36, 36);
      g.destroy();
    }

    // Power-up: slow-time icon (hourglass)
    {
      const g = mk(36, 36);
      g.fillStyle(0x133325, 0.95);
      g.fillCircle(18, 18, 14);
      g.lineStyle(2.5, 0x99ffcc, 1);
      g.strokeCircle(18, 18, 14);
      g.lineStyle(2, 0xc8ffe8, 1);
      g.strokeLineShape(new Phaser.Geom.Line(13, 10, 23, 10));
      g.strokeLineShape(new Phaser.Geom.Line(13, 26, 23, 26));
      g.strokeLineShape(new Phaser.Geom.Line(13, 10, 23, 26));
      g.strokeLineShape(new Phaser.Geom.Line(23, 10, 13, 26));
      g.generateTexture('powerup_slow', 36, 36);
      g.destroy();
    }

    // Full-width skill sweep bar (stretched to game width in PlayScene)
    {
      const W = 400;
      const H = 18;
      const g = mk(W, H);
      g.fillStyle(0x0a1f14, 0.65);
      g.fillRect(0, 0, W, H);
      g.lineStyle(2, 0x33cc77, 0.9);
      g.strokeRect(1, 1, W - 2, H - 2);
      g.lineStyle(4, 0x88ffcc, 1);
      g.beginPath();
      g.moveTo(0, H / 2);
      g.lineTo(W, H / 2);
      g.strokePath();
      g.lineStyle(1, 0xffffff, 0.5);
      g.beginPath();
      g.moveTo(0, H / 2 - 3);
      g.lineTo(W, H / 2 - 3);
      g.strokePath();
      g.beginPath();
      g.moveTo(0, H / 2 + 3);
      g.lineTo(W, H / 2 + 3);
      g.strokePath();
      g.generateTexture('skill_sweep_line', W, H);
      g.destroy();
    }

    // Boss polygons
    {
      const g = mk(120, 120);
      drawRegularPolygon(g, 60, 60, 52, 5, 0x330022, 0xff00aa, 4);
      g.generateTexture('boss_pentagon', 120, 120);
      g.destroy();
    }
    {
      const g = mk(120, 120);
      drawRegularPolygon(g, 60, 60, 52, 6, 0x221133, 0xaa66ff, 4);
      g.generateTexture('boss_hexagon', 120, 120);
      g.destroy();
    }

    this.scene.start('Menu');
  }
}
