import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceBuffRemainingMs, extendBuffRemainingMs } from '../src/systems/buffTimers.js';

test('active gameplay consumes remaining buff time', () => {
  const next = advanceBuffRemainingMs({ remainingMs: 1200, deltaMs: 200, timersPaused: false });
  assert.equal(next, 1000);
});

test('paused gameplay does not consume remaining buff time', () => {
  const next = advanceBuffRemainingMs({ remainingMs: 1200, deltaMs: 200, timersPaused: true });
  assert.equal(next, 1200);
});

test('buff extension keeps the larger duration window', () => {
  const next = extendBuffRemainingMs({ remainingMs: 800, addedMs: 5000 });
  assert.equal(next, 5000);
  const extended = extendBuffRemainingMs({ remainingMs: 6200, addedMs: 5000 });
  assert.equal(extended, 6200);
});
