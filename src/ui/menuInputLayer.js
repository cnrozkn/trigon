/**
 * Fullscreen DOM layer above the Phaser canvas so the first tap reliably reaches
 * the browser (mobile Chrome often mis-delivers to canvas with RESIZE / visualViewport).
 * Calls sync audio unlock in the same gesture, then starts the menu flow.
 */
export function attachMenuInputLayer(menuScene) {
  const container = document.getElementById('game-container');
  if (!container) return () => {};

  let el = document.getElementById('menu-input-layer');
  if (!el) {
    el = document.createElement('div');
    el.id = 'menu-input-layer';
    el.setAttribute('aria-hidden', 'true');
    Object.assign(el.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '100',
      pointerEvents: 'none',
      touchAction: 'none',
      background: 'transparent',
    });
  }
  container.appendChild(el);

  let consumed = false;
  const handle = (e) => {
    if (consumed) return;
    consumed = true;
    try {
      e.preventDefault();
    } catch (_err) {
      // ignore if listener was passive
    }
    e.stopPropagation();

    const audio = menuScene.registry.get('audio');
    if (audio?.unlockSyncFromUserGesture) {
      audio.unlockSyncFromUserGesture();
    }

    el.style.pointerEvents = 'none';
    el.removeEventListener('pointerdown', handle, true);
    el.removeEventListener('touchstart', handle, true);

    void menuScene.startGameFromMenu();
  };

  el.style.pointerEvents = 'auto';
  el.addEventListener('pointerdown', handle, { capture: true, passive: false });
  el.addEventListener('touchstart', handle, { capture: true, passive: false });

  return () => {
    consumed = true;
    el.style.pointerEvents = 'none';
    el.removeEventListener('pointerdown', handle, true);
    el.removeEventListener('touchstart', handle, true);
  };
}
