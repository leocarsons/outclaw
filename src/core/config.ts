import * as fs from 'fs/promises';
import * as path from 'path';
import { getConfigPath, ensureDir, pathExists } from '../utils/paths.js';

export interface OutclawConfig {
  api_key?: string;
  agent_id?: string;
  agent_name?: string;
  verified?: boolean;
  api_base?: string;
}

const CONFIG_FILE = 'config.json';
const DEFAULT_API_BASE = 'https://outclaws.ai/api';

/**
 * Get config file path
 */
function getConfigFilePath(): string {
  return path.join(getConfigPath(), CONFIG_FILE);
}

/**
 * Load config from disk
 */
export async function loadConfig(): Promise<OutclawConfig> {
  const configPath = getConfigFilePath();

  if (!(await pathExists(configPath))) {
    return {};
  }

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content) as OutclawConfig;
  } catch {
    return {};
  }
}

/**
 * Save config to disk
 */
export async function saveConfig(config: OutclawConfig): Promise<void> {
  const configDir = getConfigPath();
  await ensureDir(configDir);

  const configPath = getConfigFilePath();
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Clear config (logout)
 */
export async function clearConfig(): Promise<void> {
  const configPath = getConfigFilePath();

  if (await pathExists(configPath)) {
    await fs.unlink(configPath);
  }
}

/**
 * Get API key from config or environment
 */
export async function getApiKey(): Promise<string | undefined> {
  // Environment variable takes precedence
  if (process.env.OUTCLAW_API_KEY) {
    return process.env.OUTCLAW_API_KEY;
  }

  const config = await loadConfig();
  return config.api_key;
}

/**
 * Get API base URL
 */
export async function getApiBase(): Promise<string> {
  if (process.env.OUTCLAW_API_BASE) {
    return process.env.OUTCLAW_API_BASE;
  }

  const config = await loadConfig();
  return config.api_base || DEFAULT_API_BASE;
}

/**
 * Check if user is logged in
 */
export async function isLoggedIn(): Promise<boolean> {
  const apiKey = await getApiKey();
  return !!apiKey;
}
