/**
 * Tests for the tmesh init command.
 */

import { describe, test, expect } from 'bun:test';
import { buildInitSteps } from '../../../core/init';

describe('buildInitSteps', () => {
  test('returns all required steps', () => {
    const steps = buildInitSteps('kai-session', 'my-agent', '/usr/local/bin/tmesh');
    expect(steps.length).toBeGreaterThanOrEqual(3);
  });

  test('includes tmux env var step', () => {
    const steps = buildInitSteps('sess', 'agent', '/bin/tmesh');
    const envStep = steps.find((s) => s.description.includes('identity'));
    expect(envStep).toBeDefined();
  });

  test('includes alias step', () => {
    const steps = buildInitSteps('sess', 'agent', '/path/to/tmesh');
    const aliasStep = steps.find((s) => s.description.includes('alias'));
    expect(aliasStep).toBeDefined();
  });

  test('includes protocol injection step', () => {
    const steps = buildInitSteps('sess', 'agent', '/bin/tmesh');
    const protoStep = steps.find((s) => s.description.includes('protocol'));
    expect(protoStep).toBeDefined();
  });
});
