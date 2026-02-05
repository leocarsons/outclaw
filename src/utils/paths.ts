import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';

export type Scope = 'global' | 'project';

/**
 * Get the skills directory path for a given scope
 * - global: ~/.openclaw/workspace/skills/
 * - project: ./skills/ (current working directory)
 */
export function getSkillsPath(scope: Scope): string {
  if (scope === 'global') {
    return path.join(os.homedir(), '.openclaw', 'workspace', 'skills');
  }
  return path.join(process.cwd(), 'skills');
}

/**
 * Get the lock file path for a given scope
 * - global: ~/.openclaw/workspace/lock.json
 * - project: .outclaw/lock.json
 */
export function getLockFilePath(scope: Scope): string {
  if (scope === 'global') {
    return path.join(os.homedir(), '.openclaw', 'workspace', 'lock.json');
  }
  return path.join(process.cwd(), '.outclaw', 'lock.json');
}

/**
 * Get the path to a specific skill
 */
export function getSkillPath(skillName: string, scope: Scope): string {
  return path.join(getSkillsPath(scope), skillName);
}

/**
 * Get the SKILL.md path for a specific skill
 */
export function getSkillMdPath(skillName: string, scope: Scope): string {
  return path.join(getSkillPath(skillName, scope), 'SKILL.md');
}

/**
 * Ensure directory exists
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Check if a path exists
 */
export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get config directory path (for API credentials)
 */
export function getConfigPath(): string {
  return path.join(os.homedir(), '.config', 'outclaw');
}

/**
 * @deprecated Use getLockFilePath instead
 */
export function getManifestPath(scope: Scope): string {
  return getLockFilePath(scope);
}
