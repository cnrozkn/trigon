import * as Phaser from 'phaser';
import { backgroundToneForLevel, getSector } from '../data/UpgradeDefinitions.js';
import { PLAYFIELD_MARGIN } from '../data/GameConstants.js';

export default class BackgroundManager {
    constructor(scene) {
        this.scene = scene;
        this.bgTone = null;
        this.bgGlow = null;
        this.bgGridFar = null;
        this.bgGridNear = null;
        this.playfieldFrame = null;
        this.feverEdgeGlow = null;
        this.lowShieldVignette = null;
        
        this.bgTargetTone = backgroundToneForLevel(1);
        this.bgCurrentTone = this.bgTargetTone;
    }

    create() {
        const { width, height } = this.scene.scale;
        this.ensureTextures();

        this.bgTone = this.scene.add.rectangle(width * 0.5, height * 0.5, width, height, this.bgCurrentTone, 0.35).setDepth(-30);
        this.bgGlow = this.scene.add.ellipse(width * 0.5, height * 0.55, width * 1.2, height * 1.4, 0x4a3d88, 0.05).setDepth(-29);
        this.bgGridFar = this.scene.add.tileSprite(width * 0.5, height * 0.5, width, height, 'stage1_grid_line').setDepth(-28);
        this.bgGridFar.setTint(0x64b4ff).setAlpha(0.12).setBlendMode(Phaser.BlendModes.ADD);
        this.bgGridNear = this.scene.add.tileSprite(width * 0.5, height * 0.5, width, height, 'stage1_grid_line').setDepth(-27);
        this.bgGridNear.setTint(0x7a9fff).setAlpha(0.06).setBlendMode(Phaser.BlendModes.ADD).setScale(0.5);

        this.feverEdgeGlow = this.scene.add.rectangle(width * 0.5, height * 0.5, width, height, 0xff66dd, 0).setDepth(150);
        this.lowShieldVignette = this.scene.add.ellipse(width * 0.5, height * 0.64, width * 1.3, height * 1.7, 0xff4455, 0).setDepth(140);
        
        this.drawPlayfieldFrame();
    }

    ensureTextures() {
        if (!this.scene.textures.exists('stage1_grid_line')) {
            const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
            g.clear();
            g.fillStyle(0x64b4ff, 0.08);
            g.fillRect(0, 0, 2, 2);
            g.generateTexture('stage1_grid_line', 2, 2);
            g.destroy();
        }
    }

    drawPlayfieldFrame() {
        if (this.playfieldFrame) this.playfieldFrame.destroy();
        /*
        const { width, height } = this.scene.scale;
        const playLeft = PLAYFIELD_MARGIN;
        const playRight = width - PLAYFIELD_MARGIN;
        
        const g = this.scene.add.graphics().setDepth(3);
        g.lineStyle(2, 0x4a6a9a, 0.55);
        g.strokeRect(playLeft + 1, 6, playRight - playLeft - 2, height - 12);
        g.lineStyle(1, 0x223355, 0.35);
        g.strokeRect(playLeft + 3, 8, playRight - playLeft - 6, height - 16);
        this.playfieldFrame = g;
        */
    }

    update(delta, currentLevel, feverActive, shieldCharges, gameOver, isChoosingUpgrade) {
        this.bgTargetTone = feverActive ? 0x3a0f46 : backgroundToneForLevel(currentLevel);
        this.bgCurrentTone = Phaser.Display.Color.Interpolate.ColorWithColor(
            Phaser.Display.Color.ValueToColor(this.bgCurrentTone),
            Phaser.Display.Color.ValueToColor(this.bgTargetTone),
            100,
            4,
        ).color;

        if (this.bgTone) this.bgTone.setFillStyle(this.bgCurrentTone, feverActive ? 0.52 : 0.38);
        
        const sector = getSector(currentLevel);
        const sectorColors = [0x64b4ff, 0xffaa44, 0x44ffaa];
        const targetGridColor = sectorColors[sector - 1] || 0x64b4ff;
        
        if (this.bgGridFar) {
          this.bgGridFar.tilePositionY -= (18 * delta) / 1000;
          const cur = Phaser.Display.Color.ValueToColor(this.bgGridFar.tintTopLeft);
          const tgt = Phaser.Display.Color.ValueToColor(targetGridColor);
          const next = Phaser.Display.Color.Interpolate.ColorWithColor(cur, tgt, 100, 2).color;
          this.bgGridFar.setTint(next);
        }
        if (this.bgGridNear) {
          this.bgGridNear.tilePositionY -= (11 * delta) / 1000;
          this.bgGridNear.setTint(this.bgGridFar.tintTopLeft);
        }
        
        // Sector 2 (Magnetic) effect: subtle rapid flicker
        if (sector === 2 && !feverActive) {
          const glitch = Math.random() < 0.02;
          if (glitch && this.bgGridFar) {
            this.bgGridFar.setAlpha(0.24);
            this.scene.time.delayedCall(50, () => this.bgGridFar?.setAlpha(0.12));
          }
        }
        
        if (this.bgGlow) {
            const pulse = feverActive
                ? 0.09 + (Math.sin(this.scene.time.now * 0.0012) + 1) * 0.05
                : 0.03 + (Math.sin(this.scene.time.now * 0.00072) + 1) * 0.025;
            this.bgGlow.setAlpha(pulse);
            this.bgGlow.setFillStyle(feverActive ? 0xff44ee : 0x4a3d88, 1);
        }
        
        if (this.feverEdgeGlow) {
            const edgePulse = feverActive ? 0.1 + (Math.sin(this.scene.time.now * 0.0028) + 1) * 0.06 : 0;
            this.feverEdgeGlow.setAlpha(edgePulse);
        }
        
        if (this.lowShieldVignette) {
            const danger = shieldCharges === 1 && !gameOver && !isChoosingUpgrade;
            const vignetteAlpha = danger ? 0.08 + (Math.sin(this.scene.time.now * 0.0065) + 1) * 0.06 : 0;
            this.lowShieldVignette.setAlpha(vignetteAlpha);
        }
    }

    handleResize() {
        const { width, height } = this.scene.scale;
        if (this.bgTone) this.bgTone.setPosition(width * 0.5, height * 0.5).setSize(width, height);
        if (this.bgGlow) this.bgGlow.setPosition(width * 0.5, height * 0.55).setSize(width * 1.2, height * 1.4);
        if (this.bgGridFar) this.bgGridFar.setPosition(width * 0.5, height * 0.5).setSize(width, height);
        if (this.bgGridNear) this.bgGridNear.setPosition(width * 0.5, height * 0.5).setSize(width, height);
        
        this.drawPlayfieldFrame();
        
        if (this.feverEdgeGlow) this.feverEdgeGlow.setPosition(width * 0.5, height * 0.5).setSize(width, height);
        if (this.lowShieldVignette) this.lowShieldVignette.setPosition(width * 0.5, height * 0.64).setSize(width * 1.3, height * 1.7);
    }
    
    destroy() {
        if (this.playfieldFrame) this.playfieldFrame.destroy();
    }
}
