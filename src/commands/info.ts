import chalk from 'chalk';
import { SkillManager } from '../core/skill-manager.js';
import { logger } from '../ui/logger.js';
import type { Scope } from '../utils/paths.js';

export interface InfoOptions {
  global?: boolean;
}

export async function infoCommand(name: string, options: InfoOptions): Promise<void> {
  try {
    // Try both scopes if not specified
    const scopes: Scope[] = options.global ? ['global'] : ['project', 'global'];

    let skill = null;
    let foundScope: Scope | null = null;

    for (const scope of scopes) {
      const manager = new SkillManager(scope);
      skill = await manager.getSkill(name);
      if (skill) {
        foundScope = scope;
        break;
      }
    }

    if (!skill || !foundScope) {
      logger.error(`Skill "${name}" not found`);
      logger.dim('');
      logger.dim('Search for skills: outclaw search <query>');
      process.exit(1);
    }

    // Display skill info
    console.log();
    console.log(chalk.bold.cyan(`  ${skill.name}`));
    console.log();
    console.log(chalk.dim('  Description:'), skill.description);
    console.log(chalk.dim('  Version:'), skill.version || 'unversioned');
    console.log(chalk.dim('  Scope:'), foundScope);
    console.log(chalk.dim('  Path:'), skill.path);

    if (skill['user-invocable'] !== undefined) {
      console.log(chalk.dim('  User-invocable:'), skill['user-invocable'] ? 'yes' : 'no');
    }

    if (skill['disable-model-invocation'] !== undefined) {
      console.log(
        chalk.dim('  Model invocation:'),
        skill['disable-model-invocation'] ? 'disabled' : 'enabled'
      );
    }

    if (skill['allowed-tools']?.length) {
      console.log(chalk.dim('  Allowed tools:'), skill['allowed-tools'].join(', '));
    }

    if (skill['argument-hint']) {
      console.log(chalk.dim('  Arguments:'), skill['argument-hint']);
    }

    if (skill.context) {
      console.log(chalk.dim('  Context:'), skill.context);
    }

    if (skill.agent) {
      console.log(chalk.dim('  Agent:'), skill.agent);
    }

    if (skill.model) {
      console.log(chalk.dim('  Model:'), skill.model);
    }

    console.log();
    console.log(chalk.dim('  ─'.repeat(30)));
    console.log();
    console.log(chalk.dim('  Content preview:'));
    console.log();

    // Show first 10 lines of content
    const lines = skill.content.split('\n').slice(0, 10);
    for (const line of lines) {
      console.log(chalk.dim('  │ ') + line);
    }

    if (skill.content.split('\n').length > 10) {
      console.log(chalk.dim('  │ ...'));
    }

    console.log();
  } catch (error) {
    if (error instanceof Error) {
      logger.error(error.message);
    } else {
      logger.error('An unexpected error occurred');
    }
    process.exit(1);
  }
}
