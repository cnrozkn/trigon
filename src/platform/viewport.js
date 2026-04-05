/**
 * Single source of truth for layout size on mobile: visualViewport when present,
 * otherwise window. Rounded integers avoid blurry / mis-hit Phaser scaling.
 */
export function getViewportGameSize() {
  const vv = window.visualViewport;
  const w = Math.round(vv?.width ?? window.innerWidth);
  const h = Math.round(vv?.height ?? window.innerHeight);
  return {
    width: Math.max(1, w),
    height: Math.max(1, h),
  };
}

export function applyAppHeightCss() {
  const { height } = getViewportGameSize();
  document.documentElement.style.setProperty('--app-height', `${height}px`);
  return height;
}
