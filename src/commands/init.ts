import { input, select, checkbox, confirm } from '@inquirer/prompts';
import { SkillManager } from '../core/skill-manager.js';
import { logger } from '../ui/logger.js';
import type { Scope } from '../utils/paths.js';

const AVAILABLE_TOOLS = [
  { name: 'Read - Read files', value: 'Read' },
  { name: 'Write - Write files', value: 'Write' },
  { name: 'Edit - Edit files', value: 'Edit' },
  { name: 'Grep - Search file contents', value: 'Grep' },
  { name: 'Glob - Find files by pattern', value: 'Glob' },
  { name: 'Bash - Execute shell commands', value: 'Bash' },
  { name: 'WebFetch - Fetch web content', value: 'WebFetch' },
  { name: 'WebSearch - Search the web', value: 'WebSearch' },
];

export interface InitOptions {
  name?: string;
  global?: boolean;
  template?: 'minimal' | 'standard' | 'complete';
  yes?: boolean;
}

export async function initCommand(options: InitOptions): Promise<void> {
  try {
    // Determine scope
    const scope: Scope = options.global ? 'global' : 'project';

    // Get skill name
    let name = options.name;
    if (!name) {
      name = await input({
        message: 'Skill name:',
        validate: (value) => {
          if (!value) return 'Name is required';
          if (!/^[a-z0-9-]+$/.test(value)) {
            return 'Name must be lowercase alphanumeric with hyphens (e.g., my-skill)';
          }
          return true;
        },
      });
    }

    // Check if skill already exists
    const manager = new SkillManager(scope);
    if (await manager.skillExists(name)) {
      logger.error(`Skill "${name}" already exists`);
      process.exit(1);
    }

    let description: string;
    let userInvocable = true;
    let disableModelInvocation = false;
    let allowedTools: string[] = [];
    let argumentHint: string | undefined;
    let context: 'normal' | 'fork' | undefined;

    if (options.yes) {
      // Use defaults
      description = `${name} skill for Claude Code`;
    } else {
      // Interactive prompts
      description = await input({
        message: 'Description (for trigger matching):',
        validate: (value) => {
          if (!value || value.length < 10) {
            return 'Description should be at least 10 characters for good trigger matching';
          }
          return true;
        },
      });

      userInvocable = await confirm({
        message: 'User-invocable (can be called via /skill-name)?',
        default: true,
      });

      disableModelInvocation = await confirm({
        message: 'Disable automatic model invocation (only manual trigger)?',
        default: false,
      });

      allowedTools = await checkbox({
        message: 'Select allowed tools (tools that can be used without permission):',
        choices: AVAILABLE_TOOLS,
      });

      const wantsArgs = await confirm({
        message: 'Does this skill accept arguments?',
        default: false,
      });

      if (wantsArgs) {
        argumentHint = await input({
          message: 'Argument hint (e.g., [file-path] [options]):',
        });
      }

      const runInSubagent = await confirm({
        message: 'Run in isolated subagent context?',
        default: false,
      });

      if (runInSubagent) {
        context = 'fork';
      }
    }

    // Create the skill
    const skillPath = await manager.createSkill({
      name,
      description,
      scope,
      userInvocable,
      disableModelInvocation,
      allowedTools,
      argumentHint,
      context,
    });

    logger.success(`Skill created at: ${skillPath}`);
    logger.info('');
    logger.info('Next steps:');
    logger.dim(`  1. Edit ${skillPath}/SKILL.md to add your skill instructions`);
    logger.dim(`  2. Use /${name} in Claude Code to invoke your skill`);
    logger.info('');
  } catch (error) {
    if (error instanceof Error) {
      logger.error(error.message);
    } else {
      logger.error('An unexpected error occurred');
    }
    process.exit(1);
  }
}
