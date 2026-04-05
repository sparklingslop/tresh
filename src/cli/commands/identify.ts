/**
 * tmesh identify <name> -- set this session's mesh identity.
 *
 * Thin CLI wrapper over the identity SDK.
 */

import type { Result } from '../../types';
import { Ok, Err } from '../../types';
import { identify } from '../../core/identity';
import { registerCommand } from '../registry';
import { isValidIdentity } from '../util';

// ---------------------------------------------------------------------------
// Validation (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Validate CLI arguments for the identify command.
 */
export function validateIdentifyArgs(args: readonly string[]): Result<string> {
  if (args.length === 0) {
    return Err(new Error('Usage: tmesh identify <name>'));
  }

  const name = args[0]!;

  if (!isValidIdentity(name)) {
    return Err(
      new Error(
        `Invalid identity: "${name}". Must start with alphanumeric, contain only alphanumeric, dots, hyphens, underscores.`,
      ),
    );
  }

  return Ok(name);
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

registerCommand('identify', async (args, _flags) => {
  const validation = validateIdentifyArgs(args);
  if (!validation.ok) {
    process.stderr.write(validation.error.message + '\n');
    return 1;
  }

  const result = await identify(validation.value);
  if (!result.ok) {
    process.stderr.write(`Failed to set identity: ${result.error.message}\n`);
    return 1;
  }

  process.stdout.write(`Identity set to: ${result.value}\n`);
  return 0;
});
