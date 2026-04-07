/**
 * HapticService — thin wrapper around @capacitor/haptics.
 * Falls back silently in browser / non-native environments.
 * Usage: HapticService.impact('LIGHT') / .notification('SUCCESS') / .vibrate()
 */

let _haptics = null;
let _loaded = false;

async function getHaptics() {
  if (_loaded) return _haptics;
  _loaded = true;
  try {
    const mod = await import('@capacitor/haptics');
    _haptics = mod.Haptics;
  } catch {
    _haptics = null;
  }
  return _haptics;
}

// Pre-warm on module load (fire-and-forget).
getHaptics();

export const HapticService = {
  /**
   * @param {'HEAVY'|'MEDIUM'|'LIGHT'} style
   */
  async impact(style = 'MEDIUM') {
    const h = await getHaptics();
    if (!h) return;
    try {
      await h.impact({ style });
    } catch { /* no-op on web */ }
  },

  /**
   * @param {'SUCCESS'|'WARNING'|'ERROR'} type
   */
  async notification(type = 'SUCCESS') {
    const h = await getHaptics();
    if (!h) return;
    try {
      await h.notification({ type });
    } catch { /* no-op on web */ }
  },

  async vibrate(duration = 300) {
    const h = await getHaptics();
    if (!h) return;
    try {
      await h.vibrate({ duration });
    } catch { /* no-op on web */ }
  },
};
