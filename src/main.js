import { createAudioFacade } from './audio/index.js';
import { applyAppHeightCss, getViewportGameSize } from './platform/viewport.js';

async function initNativePlugins() {
  try {
    const [{ StatusBar, Style }, { ScreenOrientation }] = await Promise.all([
      import('@capacitor/status-bar'),
      import('@capacitor/screen-orientation'),
    ]);
    await Promise.allSettled([
      StatusBar.setStyle({ style: Style.Dark }),
      StatusBar.hide(),
      ScreenOrientation.lock({ orientation: 'portrait' }),
    ]);
  } catch {
    // Web environment — no native plugins available, ignore.
  }
}

function showBootError(error) {
  const root = document.getElementById('game-container') || document.body;
  const box = document.createElement('pre');
  box.textContent = `Game bootstrap failed:\n${error?.stack || error}`;
  box.style.position = 'fixed';
  box.style.inset = '12px';
  box.style.margin = '0';
  box.style.padding = '12px';
  box.style.color = '#ffb3d1';
  box.style.background = 'rgba(20, 8, 16, 0.92)';
  box.style.border = '1px solid #ff44aa';
  box.style.borderRadius = '8px';
  box.style.zIndex = '99999';
  box.style.whiteSpace = 'pre-wrap';
  box.style.font = '12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace';
  root.appendChild(box);
}

async function startGame() {
  try {
    await initNativePlugins();
    const Phaser = await import('phaser');
    const [{ default: Boot }, { default: Menu }, { default: PlayScene }, { default: PrestigeShop }, { default: AchievementsScene }, { default: UIScene }, { default: SettingsScene }, { default: StatsScene }] = await Promise.all([
      import('./scenes/Boot.js'),
      import('./scenes/Menu.js'),
      import('./scenes/PlayScene.js'),
      import('./scenes/PrestigeShop.js'),
      import('./scenes/AchievementsScene.js'),
      import('./scenes/UIScene.js'),
      import('./scenes/SettingsScene.js'),
      import('./scenes/StatsScene.js'),
    ]);

    applyAppHeightCss();
    const initialSize = getViewportGameSize();

    const config = {
      type: Phaser.WEBGL,
      parent: 'game-container',
      width: initialSize.width,
      height: initialSize.height,
      backgroundColor: '#0a0a12',
      disableContextMenu: true,
      antialias: true,
      antialiasGL: true,
      roundPixels: false,
      powerPreference: 'high-performance',
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        parent: 'game-container',
        expandParent: true,
        autoRound: true,
      },
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 0 },
          debug: false,
        },
      },
      input: {
        activePointers: 4,
      },
      scene: [Boot, Menu, PlayScene, PrestigeShop, AchievementsScene, UIScene, SettingsScene, StatsScene],
    };

    const game = new Phaser.Game(config);
    const audio = createAudioFacade();
    game.registry.set('audio', audio);

    // Keep nudging AudioContext awake on every gesture until running (covers tab focus / odd mobile states).
    const domUnlockOpts = { capture: true, passive: false };
    const domAudioNudge = () => {
      audio.unlockSyncFromUserGesture();
    };
    document.addEventListener('touchstart', domAudioNudge, domUnlockOpts);
    document.addEventListener('touchend', domAudioNudge, domUnlockOpts);
    document.addEventListener('pointerdown', domAudioNudge, domUnlockOpts);
    document.addEventListener('click', domAudioNudge, domUnlockOpts);
    const syncGameViewport = () => {
      applyAppHeightCss();
      const { width, height } = getViewportGameSize();
      game.scale.resize(width, height);
      game.scale.refresh();
    };
    let viewportSyncId = 0;
    const queueViewportSync = () => {
      if (viewportSyncId) return;
      viewportSyncId = requestAnimationFrame(() => {
        viewportSyncId = 0;
        syncGameViewport();
      });
    };
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', queueViewportSync);
      window.visualViewport.addEventListener('scroll', queueViewportSync);
    }
    window.addEventListener('resize', queueViewportSync);
    const onOrientationChange = () => {
      queueViewportSync();
      globalThis.setTimeout(queueViewportSync, 120);
      globalThis.setTimeout(queueViewportSync, 400);
    };
    window.addEventListener('orientationchange', onOrientationChange);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        game.loop.sleep();
      } else {
        game.loop.wake(true);
        audio.resume();
        queueViewportSync();
      }
    });
    window.addEventListener(
      'beforeunload',
      () => {
        document.removeEventListener('touchstart', domAudioNudge, domUnlockOpts);
        document.removeEventListener('touchend', domAudioNudge, domUnlockOpts);
        document.removeEventListener('pointerdown', domAudioNudge, domUnlockOpts);
        document.removeEventListener('click', domAudioNudge, domUnlockOpts);
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', queueViewportSync);
          window.visualViewport.removeEventListener('scroll', queueViewportSync);
        }
        window.removeEventListener('resize', queueViewportSync);
        window.removeEventListener('orientationchange', onOrientationChange);
        audio.destroy();
      },
      { once: true },
    );
    syncGameViewport();
  } catch (error) {
    console.error(error);
    showBootError(error);
  }
}

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    startGame();
  });
});
