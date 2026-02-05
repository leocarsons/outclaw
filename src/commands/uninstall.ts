import { confirm } from '@inquirer/prompts';
import { SkillManager } from '../core/skill-manager.js';
import { logger } from '../ui/logger.js';
import { spinner } from '../ui/spinner.js';
import type { Scope } from '../utils/paths.js';

export interface UninstallOptions {
  global?: boolean;
  yes?: boolean;
}

export async function uninstallCommand(name: string, options: UninstallOptions): Promise<void> {
  try {
    const scope: Scope = options.global ? 'global' : 'project';
    const manager = new SkillManager(scope);

    // Check if skill exists
    const skill = await manager.getSkill(name);

    if (!skill) {
      logger.error(`Skill "${name}" not found in ${scope} skills`);
      process.exit(1);
    }

    // Confirm uninstall
    if (!options.yes) {
      const proceed = await confirm({
        message: `Are you sure you want to uninstall "${name}"?`,
        default: false,
      });

      if (!proceed) {
        logger.info('Uninstall cancelled');
        return;
      }
    }

    const spin = spinner(`Uninstalling ${name}...`).start();

    await manager.uninstallSkill(name);

    spin.succeed(`Uninstalled ${name}`);
  } catch (error) {
    if (error instanceof Error) {
      logger.error(error.message);
    } else {
      logger.error('An unexpected error occurred');
    }
    process.exit(1);
  }
}
