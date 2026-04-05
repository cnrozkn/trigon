const BASE_TRAIL_INTERVAL_MS = 34;

export function isGameplayActionPaused(flags = {}) {
  return Boolean(flags.gameOver || flags.isChoosingUpgrade || flags.isPausedByUser || flags.onboardingActive);
}

export function applyGameOverCombatCleanup(scene) {
  scene?.clearTransientCombatVisuals?.();
  scene?.waveManager?.setPaused?.(true);
}

export function computeBulletTrailIntervalMs({ activeBulletCount = 0, feverActive = false } = {}) {
  if (activeBulletCount <= 40) return BASE_TRAIL_INTERVAL_MS;
  const overage = activeBulletCount - 40;
  const scaled = BASE_TRAIL_INTERVAL_MS + overage * 0.55;
  const feverTax = feverActive ? 8 : 0;
  return Math.round(Math.min(90, scaled + feverTax));
}
