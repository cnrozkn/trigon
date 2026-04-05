import { createAudioFacade } from './audio/index.js';

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
    const Phaser = await import('phaser');
    const [{ default: Boot }, { default: Menu }, { default: PlayScene }] = await Promise.all([
      import('./scenes/Boot.js'),
      import('./scenes/Menu.js'),
      import('./scenes/PlayScene.js'),
    ]);

    const syncViewportHeight = () => {
      const vv = window.visualViewport;
      const h = Math.round(vv ? vv.height : window.innerHeight);
      document.documentElement.style.setProperty('--app-height', `${h}px`);
      return h;
    };

    syncViewportHeight();

    const config = {
      type: Phaser.AUTO,
      parent: 'game-container',
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: '#0a0a12',
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        parent: 'game-container',
        expandParent: true,
      },
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 0 },
          debug: false,
        },
      },
      scene: [Boot, Menu, PlayScene],
    };

    const game = new Phaser.Game(config);
    const audio = createAudioFacade();
    game.registry.set('audio', audio);
    const syncGameViewport = () => {
      const vv = window.visualViewport;
      const w = Math.round(vv ? vv.width : window.innerWidth);
      const h = syncViewportHeight();
      game.scale.resize(w, h);
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
    window.addEventListener('orientationchange', queueViewportSync);
    window.addEventListener(
      'beforeunload',
      () => {
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', queueViewportSync);
          window.visualViewport.removeEventListener('scroll', queueViewportSync);
        }
        window.removeEventListener('resize', queueViewportSync);
        window.removeEventListener('orientationchange', queueViewportSync);
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
