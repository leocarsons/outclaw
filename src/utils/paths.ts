import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';

export type Scope = 'global' | 'project';

// Cache for openclaw config
let openclawConfigCache: OpenclawConfig | null | undefined = undefined;

interface OpenclawConfig {
  agents?: {
    defaults?: {
      workspace?: string;
    };
    list?: Array<{
      id?: string;
      default?: boolean;
      workspace?: string;
    }>;
  };
  agent?: {
    workspace?: string;
  };
}

/**
 * Get OpenClaw config file path
 */
function getOpenclawConfigPath(): string {
  const override = process.env.OPENCLAW_CONFIG_PATH?.trim();
  if (override) {
    return resolveUserPath(override);
  }
  const stateDir = process.env.OPENCLAW_STATE_DIR?.trim();
  if (stateDir) {
    return path.join(resolveUserPath(stateDir), 'openclaw.json');
  }
  return path.join(os.homedir(), '.openclaw', 'openclaw.json');
}

/**
 * Resolve user path (expand ~ to home directory)
 */
function resolveUserPath(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('~')) {
    return path.resolve(trimmed.replace(/^~(?=$|[\\/])/, os.homedir()));
  }
  return path.resolve(trimmed);
}

/**
 * Read OpenClaw config file
 */
async function readOpenclawConfig(): Promise<OpenclawConfig | null> {
  if (openclawConfigCache !== undefined) {
    return openclawConfigCache;
  }

  try {
    const configPath = getOpenclawConfigPath();
    const raw = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      openclawConfigCache = null;
      return null;
    }
    openclawConfigCache = parsed as OpenclawConfig;
    return openclawConfigCache;
  } catch {
    openclawConfigCache = null;
    return null;
  }
}

/**
 * Get workspace path from OpenClaw config
 */
async function getWorkspaceFromConfig(): Promise<string | null> {
  const config = await readOpenclawConfig();
  if (!config) return null;

  // Check agents.defaults.workspace first
  const defaultsWorkspace = config.agents?.defaults?.workspace;
  if (defaultsWorkspace) {
    return resolveUserPath(defaultsWorkspace);
  }

  // Check legacy agent.workspace
  const agentWorkspace = config.agent?.workspace;
  if (agentWorkspace) {
    return resolveUserPath(agentWorkspace);
  }

  // Check agents.list for default agent
  const listedAgents = config.agents?.list ?? [];
  const defaultAgent = listedAgents.find((entry) => entry.default) ??
    listedAgents.find((entry) => entry.id === 'main');
  if (defaultAgent?.workspace) {
    return resolveUserPath(defaultAgent.workspace);
  }

  return null;
}

/**
 * Get the default workspace path (fallback)
 */
function getDefaultWorkspace(): string {
  return path.join(os.homedir(), '.openclaw', 'workspace');
}

/**
 * Get the skills directory path for a given scope
 * - global: reads from ~/.openclaw/openclaw.json or falls back to ~/.openclaw/workspace/skills/
 * - project: ./skills/ (current working directory)
 */
export function getSkillsPath(scope: Scope): string {
  if (scope === 'global') {
    // For sync version, use cached value or default
    // The async version should be preferred when possible
    return path.join(getDefaultWorkspace(), 'skills');
  }
  return path.join(process.cwd(), 'skills');
}

/**
 * Async version that reads from config
 */
export async function getSkillsPathAsync(scope: Scope): Promise<string> {
  if (scope === 'global') {
    const workspace = await getWorkspaceFromConfig();
    return path.join(workspace || getDefaultWorkspace(), 'skills');
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
    return path.join(getDefaultWorkspace(), 'lock.json');
  }
  return path.join(process.cwd(), '.outclaw', 'lock.json');
}

/**
 * Async version that reads from config
 */
export async function getLockFilePathAsync(scope: Scope): Promise<string> {
  if (scope === 'global') {
    const workspace = await getWorkspaceFromConfig();
    return path.join(workspace || getDefaultWorkspace(), 'lock.json');
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
 * Async version that reads from config
 */
export async function getSkillPathAsync(skillName: string, scope: Scope): Promise<string> {
  const skillsPath = await getSkillsPathAsync(scope);
  return path.join(skillsPath, skillName);
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
