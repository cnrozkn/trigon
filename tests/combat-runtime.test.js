import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyGameOverCombatCleanup,
  computeBulletTrailIntervalMs,
  isGameplayActionPaused,
} from '../src/systems/combatRuntime.js';

test('game over cleanup clears transient visuals and pauses wave flow', () => {
  let cleared = false;
  let pausedValue = null;
  const scene = {
    clearTransientCombatVisuals: () => {
      cleared = true;
    },
    waveManager: {
      setPaused: (value) => {
        pausedValue = value;
      },
    },
  };

  applyGameOverCombatCleanup(scene);

  assert.equal(cleared, true);
  assert.equal(pausedValue, true);
});

test('gameplay action pauses for upgrade and user pause', () => {
  assert.equal(isGameplayActionPaused({ isChoosingUpgrade: true }), true);
  assert.equal(isGameplayActionPaused({ isPausedByUser: true }), true);
  assert.equal(isGameplayActionPaused({ gameOver: false, onboardingActive: false }), false);
});

test('trail interval scales up under heavy bullet load', () => {
  assert.equal(computeBulletTrailIntervalMs({ activeBulletCount: 10, feverActive: false }), 34);
  const heavy = computeBulletTrailIntervalMs({ activeBulletCount: 75, feverActive: false });
  const heavyFever = computeBulletTrailIntervalMs({ activeBulletCount: 75, feverActive: true });
  assert.ok(heavy > 34, `expected heavy interval > 34, got ${heavy}`);
  assert.ok(heavyFever >= heavy, `expected fever interval >= heavy interval, got ${heavyFever} < ${heavy}`);
});
