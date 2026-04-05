/**
 * Tests for session initialization.
 */

import { describe, test, expect } from 'bun:test';
import { buildInitSteps } from '../init';

describe('buildInitSteps', () => {
  test('returns all required steps', () => {
    const steps = buildInitSteps('kai-session', 'my-agent', '/usr/local/bin/tmesh');
    expect(steps.length).toBeGreaterThanOrEqual(3);
  });

  test('first step sets tmux env var', () => {
    const steps = buildInitSteps('sess', 'agent', '/bin/tmesh');
    expect(steps[0]!.command).toContain('set-environment');
    expect(steps[0]!.command).toContain('TMESH_IDENTITY');
    expect(steps[0]!.command).toContain('agent');
  });

  test('includes alias step with binary path', () => {
    const steps = buildInitSteps('sess', 'agent', '/custom/path/tmesh');
    const aliasStep = steps.find((s) => s.description.includes('alias'));
    expect(aliasStep).toBeDefined();
    const cmd = aliasStep!.command.join(' ');
    expect(cmd).toContain('/custom/path/tmesh');
  });

  test('includes identity export', () => {
    const steps = buildInitSteps('sess', 'my-agent', '/bin/tmesh');
    const exportStep = steps.find((s) => s.description.includes('Export'));
    expect(exportStep).toBeDefined();
    const cmd = exportStep!.command.join(' ');
    expect(cmd).toContain('TMESH_IDENTITY=my-agent');
  });

  test('includes protocol primer injection', () => {
    const steps = buildInitSteps('sess', 'agent', '/bin/tmesh');
    const protoStep = steps.find((s) => s.description.includes('protocol'));
    expect(protoStep).toBeDefined();
    const cmd = protoStep!.command.join(' ');
    expect(cmd).toContain('tmesh mesh protocol');
  });

  test('primer mentions the identity', () => {
    const steps = buildInitSteps('sess', 'cool-agent', '/bin/tmesh');
    const protoStep = steps.find((s) => s.description.includes('protocol'))!;
    const cmd = protoStep.command.join(' ');
    expect(cmd).toContain('cool-agent');
  });

  test('all steps target the correct session', () => {
    const steps = buildInitSteps('kai-target-session', 'agent', '/bin/tmesh');
    for (const step of steps) {
      expect(step.command).toContain('kai-target-session');
    }
  });
});
