export function advanceBuffRemainingMs({ remainingMs = 0, deltaMs = 0, timersPaused = false } = {}) {
  if (timersPaused) return Math.max(0, remainingMs);
  return Math.max(0, remainingMs - Math.max(0, deltaMs));
}

export function extendBuffRemainingMs({ remainingMs = 0, addedMs = 0 } = {}) {
  return Math.max(Math.max(0, remainingMs), Math.max(0, addedMs));
}
