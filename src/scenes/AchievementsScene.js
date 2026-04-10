import * as Phaser from 'phaser';
import { loadGameProfile, saveGameProfile } from '../utils/Storage.js';
import { ACHIEVEMENTS } from '../systems/AchievementSystem.js';
import { getSafeAreaInsets } from '../platform/viewport.js';

export default class AchievementsScene extends Phaser.Scene {
  constructor() {
    super({ key: 'AchievementsScene' });
    this._scrollY = 0;
    this._filter = 'all';
  }

  create() {
    const menu = this.scene.get('Menu');
    if (menu) menu.setUIVisible(false);

    this._build();
    this.scale.on('resize', () => { this._scrollY = 0; this._build(); });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (menu) menu.setUIVisible(true);
      this.scale.off('resize');
      this.input.off('wheel');
    });
  }

  _build() {
    this.children.removeAll(true);
    const { width, height } = this.scale;
    this.audio = this.registry.get('audio') || null;

    // Dark Overlay Background
    const bg = this.add.graphics().setDepth(0);
    bg.fillStyle(0x07090f, 0.94); // Higher opacity
    bg.fillRect(0, 0, width, height);
    
    // Catch clicks
    this.add.zone(width/2, height/2, width, height).setInteractive();

    const profile = loadGameProfile();
    const unlockedIds = new Set(profile.achievements || []);
    const claimedIds  = new Set(profile.claimedAchievementRewards || []);
    const unlockedCount = ACHIEVEMENTS.filter(a => unlockedIds.has(a.id)).length;
    const totalCount    = ACHIEVEMENTS.length;

    // Header
    const safeTop = Math.max(getSafeAreaInsets().top + 16, height * 0.05);
    
    this.add.text(width / 2, safeTop + 24, 'ACHIEVEMENTS', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#00ffcc',
    }).setOrigin(0.5).setDepth(20).setStroke('#ff00aa', 2).setShadow(0, 0, 15, '#00ffff', true, true);

    this.add.text(width / 2, safeTop + 54, `${unlockedCount} / ${totalCount} UNLOCKED`, {
      fontFamily: 'ui-monospace, monospace',
      fontSize: '14px',
      color: '#8ab0cc',
    }).setOrigin(0.5).setDepth(20);

    // Filter tabs
    const tabY = safeTop + 85;
    const tabH = 34;
    const filters = [
      { key: 'all',      label: 'ALL'      },
      { key: 'unlocked', label: 'UNLOCKED' },
      { key: 'locked',   label: 'LOCKED'   },
    ];
    const tabW = Math.min(width * 0.92, 420);
    const tabStartX = (width - tabW) / 2;
    const itemW = tabW / filters.length;

    this._filterBtns = filters.map(({ key, label }, i) => {
      const x = tabStartX + itemW * i + itemW / 2;
      const btn = this.add.text(x, tabY + tabH / 2, label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(20).setInteractive({ useHandCursor: true });
      
      const underline = this.add.graphics().setDepth(19);
      btn.underline = underline;

      btn.on('pointerdown', () => {
        if (this.audio) this.audio.playUpgradeSelect();
        this._filter = key;
        this._scrollY = 0;
        this._refreshFilterBtns(tabStartX, itemW, tabY, tabH);
        this._refreshList(unlockedIds, claimedIds, width, listTop);
      });

      return { key, btn };
    });
    this._refreshFilterBtns(tabStartX, itemW, tabY, tabH);

    // Back button — account for home indicator / safe area
    const safeBot = Math.max(getSafeAreaInsets().bottom + 16, height * 0.06);
    const backH = 48;
    const backY = height - safeBot - backH;
    
    this.createMenuButton(width / 2, backY + backH / 2, '← BACK', () => {
       if (this.audio) this.audio.playUpgradeSelect();
       this.scene.stop();
    }, 0x00ffcc);

    // Scrollable list
    const listTop    = tabY + tabH + 25;
    const listBottom = backY - 25;
    this._listTop = listTop;
    this._maskH   = listBottom - listTop;

    const maskShape = this.make.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(0, listTop, width, this._maskH);
    const mask = maskShape.createGeometryMask();

    this.listContainer = this.add.container(0, 0).setDepth(5).setMask(mask);

    const scrollZone = this.add.zone(0, listTop, width, this._maskH)
      .setOrigin(0).setInteractive({ draggable: true }).setDepth(4);
    scrollZone.on('dragstart', (_p, _x, y) => { this._dragStartY = y; });
    scrollZone.on('drag', (_p, _x, y) => {
      this._applyScroll(this._scrollY + (y - this._dragStartY) * 1.6);
      this._dragStartY = y;
    });

    this.input.off('wheel');
    this.input.on('wheel', (_p, _gx, _gy, _dx, dy) => {
      this._applyScroll(this._scrollY - dy * 0.5);
    });

    this._refreshList(unlockedIds, claimedIds, width, listTop);
  }

  createMenuButton(x, y, text, onClick, strokeColor = 0x4a90e2) {
    const btn = this.add.container(x, y).setDepth(60);
    const bg = this.add.graphics();
    const btnW = 180;
    const btnH = 48; // iOS minimum touch target 44pt
    
    const draw = (hover) => {
      bg.clear();
      bg.fillStyle(0x0f182b, hover ? 0.95 : 0.85);
      bg.lineStyle(2, strokeColor, hover ? 1 : 0.8);
      bg.fillRoundedRect(-btnW/2, -btnH/2, btnW, btnH, 10);
      bg.strokeRoundedRect(-btnW/2, -btnH/2, btnW, btnH, 10);
      if (hover) {
        bg.lineStyle(4, strokeColor, 0.3);
        bg.strokeRoundedRect(-btnW/2 - 2, -btnH/2 - 2, btnW + 4, btnH + 4, 12);
      }
    };
    draw(false);

    let content;
    if (text.includes('←')) {
      const labelText = text.replace('←', '').trim();
      
      // Create a graphics arrow for perfect cross-platform alignment
      const arrow = this.add.graphics();
      const arrowSize = 5;
      arrow.lineStyle(2.5, 0xe6f1ff, 1);
      arrow.beginPath();
      arrow.moveTo(arrowSize, -arrowSize);
      arrow.lineTo(0, 0);
      arrow.lineTo(arrowSize, arrowSize);
      arrow.strokePath();
      
      const label = this.add.text(12, 0, labelText, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#e6f1ff',
      }).setOrigin(0, 0.5);
      
      content = this.add.container(0, 0, [arrow, label]);
      const groupWidth = arrowSize + 12 + label.width;
      arrow.x = -groupWidth / 2;
      label.x = arrow.x + 12;
    } else {
      content = this.add.text(0, 0, text, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#e6f1ff',
      }).setOrigin(0.5);
    }

    btn.add([bg, content]);

    const zone = this.add.zone(0, 0, btnW, btnH).setInteractive({ useHandCursor: true });
    btn.add(zone);

    zone.on('pointerdown', onClick);
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => draw(false));
  }

  _refreshFilterBtns(tabStartX, itemW, tabY, tabH) {
    this._filterBtns.forEach(({ key, btn }) => {
      const active = key === this._filter;
      btn.setColor(active ? '#00ffcc' : '#667788');
      btn.setShadow(0, 0, active ? 10 : 0, '#00ffcc', true, true);
      
      btn.underline.clear();
      if (active) {
        btn.underline.lineStyle(2, 0x00ffcc, 1);
        btn.underline.lineBetween(btn.x - 20, tabY + tabH, btn.x + 20, tabY + tabH);
      }
    });
  }

  _claimReward(achId, reward) {
    const profile = loadGameProfile();
    if ((profile.claimedAchievementRewards || []).includes(achId)) return;
    profile.coins = (profile.coins || 0) + reward;
    profile.claimedAchievementRewards = [...(profile.claimedAchievementRewards || []), achId];
    saveGameProfile(profile);

    // Refresh only the list content instead of the whole scene to preserve scroll position
    const unlockedIds = new Set(profile.achievements || []);
    const claimedIds  = new Set(profile.claimedAchievementRewards || []);
    this._refreshList(unlockedIds, claimedIds, this.scale.width, this._listTop);
  }

  _refreshList(unlockedIds, claimedIds, width, listTop) {
    this.listContainer.removeAll(true);
    this.listContainer.y = 0;

    const rowW = Math.min(340, width * 0.92);
    const rowH = 82;
    const gap  = 12;
    const cx   = width / 2;

    const filtered = ACHIEVEMENTS.filter((ach) => {
      const isUnlocked = unlockedIds.has(ach.id);
      if (this._filter === 'unlocked') return isUnlocked;
      if (this._filter === 'locked')   return !isUnlocked;
      return true;
    });

    filtered.forEach((ach, i) => {
      const isUnlocked = unlockedIds.has(ach.id);
      const isClaimed  = claimedIds.has(ach.id);
      const hasClaimBtn = isUnlocked && !isClaimed && ach.reward;
      const y = listTop + 5 + i * (rowH + gap);
      const x = cx - rowW / 2;

      // Card background
      const cardBg = this.add.graphics();
      const drawCard = (hover) => {
        cardBg.clear();
        let strokeColor = 0x2a4060;
        let strokeAlpha = 0.5;
        if (isUnlocked && !isClaimed) {
          strokeColor = 0xffd700;
          strokeAlpha = 0.8;
        } else if (isUnlocked) {
          strokeColor = 0x00ffcc;
          strokeAlpha = 0.6;
        }
        
        cardBg.fillStyle(0x0f182b, hover ? 0.95 : 0.8);
        cardBg.lineStyle(2, strokeColor, strokeAlpha);
        cardBg.fillRoundedRect(x, y, rowW, rowH, 12);
        cardBg.strokeRoundedRect(x, y, rowW, rowH, 12);
        
        if (isUnlocked && !isClaimed) {
          cardBg.lineStyle(4, 0xffd700, 0.15);
          cardBg.strokeRoundedRect(x - 2, y - 2, rowW + 4, rowH + 4, 14);
        }
      };
      drawCard(false);
      this.listContainer.add(cardBg);

      // Icon
      const icon = this.add.text(x + 22, y + rowH / 2, isUnlocked ? ach.icon : '🔒', {
        fontSize: '24px',
      }).setOrigin(0.5).setAlpha(isUnlocked ? 1 : 0.35);
      this.listContainer.add(icon);

      // Name + desc
      const textX = x + 50;
      const maxTextW = rowW - 60 - (hasClaimBtn ? 100 : 30);

      const nameTxt = this.add.text(textX, y + 18, ach.name, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '17px',
        fontStyle: 'bold',
        color: isUnlocked ? (isClaimed ? '#ffffff' : '#ffd700') : '#556677',
      }).setOrigin(0, 0);
      this.listContainer.add(nameTxt);

      const descTxt = this.add.text(textX, y + 46, ach.desc, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: isUnlocked ? '#8ab0cc' : '#445566',
        wordWrap: { width: maxTextW },
      }).setOrigin(0, 0);
      this.listContainer.add(descTxt);

      // Claim button
      if (hasClaimBtn) {
        const btnW = 85;
        const btnH = 34;
        const btnX = x + rowW - btnW - 14;
        const btnY = y + (rowH - btnH) / 2;

        const btnGfx = this.add.graphics();
        const drawBtn = (hover) => {
          btnGfx.clear();
          btnGfx.fillStyle(0xffd700, hover ? 1 : 0.85);
          btnGfx.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
        };
        drawBtn(false);
        this.listContainer.add(btnGfx);

        const btnLbl = this.add.text(btnX + btnW / 2, btnY + btnH / 2, `+${ach.reward} C`, {
          fontFamily: 'ui-monospace, monospace',
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#000000',
        }).setOrigin(0.5);
        this.listContainer.add(btnLbl);

        const btnZone = this.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
          .setInteractive({ useHandCursor: true });
        btnZone.on('pointerover', () => { drawBtn(true); drawCard(true); });
        btnZone.on('pointerout',  () => { drawBtn(false); drawCard(false); });
        btnZone.on('pointerdown', () => {
          if (this.audio) this.audio.playLevelUp?.();
          this._claimReward(ach.id, ach.reward);
        });
        this.listContainer.add(btnZone);

      } else if (isUnlocked) {
        const tick = this.add.text(x + rowW - 25, y + rowH / 2, '✔', {
          fontSize: '20px',
          color: '#00ffcc',
        }).setOrigin(0.5).setAlpha(0.8);
        this.listContainer.add(tick);
      }
    });

    this._totalListH = filtered.length * (rowH + gap) + 20;
    this._applyScroll(this._scrollY);
  }

  _applyScroll(targetY) {
    const maxScroll = Math.max(0, this._totalListH - this._maskH);
    this._scrollY = Phaser.Math.Clamp(targetY, -maxScroll, 0);
    this.listContainer.y = this._scrollY;
  }

  update(_time, delta) {
    if (this.bgShape) this.bgShape.rotation += (delta / 1000) * 0.15;
    if (this.bgGlow) this.bgGlow.alpha = 0.04 + (Math.sin(this.time.now * 0.001) + 1) * 0.02;
  }
}
