/** Long enough for slow phones; short enough that we never soft-lock the menu if resume() hangs. */
export const MENU_AUDIO_UNLOCK_MAX_MS = 8000;

/**
 * Waits for Web Audio unlock (`audio.resume()`), capped by `timeoutMs`.
 * Use `timeoutMs <= 0` for uncapped wait (tests only).
 */
export async function resumeMenuAudioWithTimeout(audio, timeoutMs = MENU_AUDIO_UNLOCK_MAX_MS) {
  if (!audio || typeof audio.resume !== 'function') return false;

  const resumeResult = Promise.resolve(audio.resume())
    .then((ok) => Boolean(ok))
    .catch(() => false);

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return resumeResult;
  }

  const timeoutResult = new Promise((resolve) => {
    globalThis.setTimeout(() => resolve(false), timeoutMs);
  });

  try {
    return await Promise.race([resumeResult, timeoutResult]);
  } catch (_err) {
    return false;
  }
}
