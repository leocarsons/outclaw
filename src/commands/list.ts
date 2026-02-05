import { SkillManager, type SkillInfo } from '../core/skill-manager.js';
import { logger } from '../ui/logger.js';
import { renderTable } from '../ui/table.js';
import type { Scope } from '../utils/paths.js';

export interface ListOptions {
  global?: boolean;
  project?: boolean;
  json?: boolean;
}

export async function listCommand(options: ListOptions): Promise<void> {
  try {
    const scopes: Scope[] = [];

    if (options.global) {
      scopes.push('global');
    } else if (options.project) {
      scopes.push('project');
    } else {
      scopes.push('global', 'project');
    }

    const allSkills: SkillInfo[] = [];

    for (const scope of scopes) {
      const manager = new SkillManager(scope);
      const skills = await manager.listSkills();
      allSkills.push(...skills);
    }

    if (allSkills.length === 0) {
      logger.info('No skills installed.');
      logger.info('');
      logger.dim('Install skills with: outclaw install <skill>');
      logger.dim('Create a new skill with: outclaw init');
      return;
    }

    if (options.json) {
      console.log(JSON.stringify(allSkills, null, 2));
      return;
    }

    logger.info(`Found ${allSkills.length} skill(s):\n`);

    renderTable({
      headers: ['Name', 'Version', 'Scope', 'Description'],
      rows: allSkills.map((s) => [
        s.name,
        s.version || '-',
        s.scope,
        s.description.length > 50 ? s.description.slice(0, 47) + '...' : s.description,
      ]),
    });
  } catch (error) {
    if (error instanceof Error) {
      logger.error(error.message);
    } else {
      logger.error('An unexpected error occurred');
    }
    process.exit(1);
  }
}
