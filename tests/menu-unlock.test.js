import test from 'node:test';
import assert from 'node:assert/strict';
import { resumeMenuAudioWithTimeout } from '../src/audio/menuUnlock.js';

test('returns true when resume resolves quickly', async () => {
  const audio = {
    resume: async () => true,
  };

  const ok = await resumeMenuAudioWithTimeout(audio, 50);
  assert.equal(ok, true);
});

test('default cap still waits for slow resume within limit', async () => {
  const audio = {
    resume: async () => {
      await new Promise((r) => globalThis.setTimeout(r, 80));
      return true;
    },
  };

  const ok = await resumeMenuAudioWithTimeout(audio);
  assert.equal(ok, true);
});

test('returns false quickly when resume hangs forever', async () => {
  const audio = {
    resume: async () => new Promise(() => {}),
  };

  const startedAt = Date.now();
  const ok = await resumeMenuAudioWithTimeout(audio, 25);
  const elapsedMs = Date.now() - startedAt;

  assert.equal(ok, false);
  assert.ok(elapsedMs < 120, `timeout path should not block; elapsed=${elapsedMs}ms`);
});

test('returns false when resume throws', async () => {
  const audio = {
    resume: async () => {
      throw new Error('resume failed');
    },
  };

  const ok = await resumeMenuAudioWithTimeout(audio, 30);
  assert.equal(ok, false);
});
