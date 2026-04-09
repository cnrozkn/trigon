/**
 * Single source of truth for layout size on mobile: visualViewport when present,
 * otherwise window. Rounded integers avoid blurry / mis-hit Phaser scaling.
 */
export function getViewportGameSize() {
  const container = document.getElementById('game-container');
  if (container) {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w > 0 && h > 0) {
      return { width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)) };
    }
  }
  const vv = window.visualViewport;
  const w = Math.round(vv?.width ?? window.innerWidth);
  const h = Math.round(vv?.height ?? window.innerHeight);
  return { width: Math.max(1, w), height: Math.max(1, h) };
}

export function applyAppHeightCss() {
  const { height } = getViewportGameSize();
  document.documentElement.style.setProperty('--app-height', `${height}px`);
  return height;
}

/**
 * Returns the actual safe-area insets in CSS pixels.
 * Reads from CSS custom properties set in index.html via env().
 */
export function getSafeAreaInsets() {
  const style = getComputedStyle(document.documentElement);
  return {
    top: parseFloat(style.getPropertyValue('--safe-area-top')) || 0,
    bottom: parseFloat(style.getPropertyValue('--safe-area-bottom')) || 0,
  };
}
