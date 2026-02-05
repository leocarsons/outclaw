import * as fs from 'fs/promises';
import * as path from 'path';
import { SkillParser, generateSkillMd } from '../parsers/skill-parser.js';
import {
  getSkillsPathAsync,
  getSkillPathAsync,
  getLockFilePathAsync,
  ensureDir,
  pathExists,
  type Scope,
} from '../utils/paths.js';
import type { Skill, SkillFrontmatter } from '../schemas/skill.schema.js';
import type { OutclawManifest, SkillManifest, SkillSource } from '../schemas/manifest.schema.js';

export interface SkillInfo extends Skill {
  scope: Scope;
}

export interface CreateSkillOptions {
  name: string;
  description: string;
  version?: string;
  disableModelInvocation?: boolean;
  userInvocable?: boolean;
  allowedTools?: string[];
  argumentHint?: string;
  model?: string;
  context?: 'normal' | 'fork';
  agent?: string;
  scope: Scope;
  content?: string;
}

export interface InstallOptions {
  force?: boolean;
  source: SkillSource;
}

export class SkillManager {
  private scope: Scope;
  private basePath: string | null = null;

  constructor(scope: Scope = 'project') {
    this.scope = scope;
  }

  private async getBasePath(): Promise<string> {
    if (!this.basePath) {
      this.basePath = await getSkillsPathAsync(this.scope);
    }
    return this.basePath;
  }

  /**
   * List all installed skills
   */
  async listSkills(): Promise<SkillInfo[]> {
    const skills: SkillInfo[] = [];
    const basePath = await this.getBasePath();

    try {
      const dirs = await fs.readdir(basePath);

      for (const dir of dirs) {
        // Skip hidden files and manifest
        if (dir.startsWith('.')) continue;

        const skillPath = path.join(basePath, dir);
        const stat = await fs.stat(skillPath);

        if (stat.isDirectory()) {
          try {
            const parser = new SkillParser(skillPath);
            const skill = await parser.parse();
            skills.push({ ...skill, scope: this.scope });
          } catch {
            // Skip invalid skills
          }
        }
      }
    } catch {
      // Directory doesn't exist
    }

    return skills;
  }

  /**
   * Get a specific skill by name
   */
  async getSkill(name: string): Promise<SkillInfo | null> {
    const skillPath = await getSkillPathAsync(name, this.scope);

    try {
      const parser = new SkillParser(skillPath);
      const skill = await parser.parse();
      return { ...skill, scope: this.scope };
    } catch {
      return null;
    }
  }

  /**
   * Check if a skill exists
   */
  async skillExists(name: string): Promise<boolean> {
    const skillPath = await getSkillPathAsync(name, this.scope);
    return await pathExists(path.join(skillPath, 'SKILL.md'));
  }

  /**
   * Create a new skill
   */
  async createSkill(options: CreateSkillOptions): Promise<string> {
    const skillPath = await getSkillPathAsync(options.name, options.scope);

    // Check if skill already exists
    if (await pathExists(skillPath)) {
      throw new Error(`Skill "${options.name}" already exists at ${skillPath}`);
    }

    // Create skill directory
    await ensureDir(skillPath);

    // Build frontmatter
    const frontmatter: Partial<SkillFrontmatter> = {
      name: options.name,
      description: options.description,
      version: options.version || '1.0.0',
    };

    if (options.disableModelInvocation !== undefined) {
      frontmatter['disable-model-invocation'] = options.disableModelInvocation;
    }
    if (options.userInvocable !== undefined) {
      frontmatter['user-invocable'] = options.userInvocable;
    }
    if (options.allowedTools?.length) {
      frontmatter['allowed-tools'] = options.allowedTools;
    }
    if (options.argumentHint) {
      frontmatter['argument-hint'] = options.argumentHint;
    }
    if (options.model) {
      frontmatter.model = options.model;
    }
    if (options.context) {
      frontmatter.context = options.context;
    }
    if (options.agent) {
      frontmatter.agent = options.agent;
    }

    // Generate SKILL.md content
    const content = options.content || `# ${options.name}\n\nYour skill instructions here...\n`;
    const skillMdContent = generateSkillMd(frontmatter, content);

    // Write SKILL.md
    await fs.writeFile(path.join(skillPath, 'SKILL.md'), skillMdContent, 'utf-8');

    return skillPath;
  }

  /**
   * Install a skill from content
   */
  async installSkill(
    name: string,
    skillMdContent: string,
    options: InstallOptions
  ): Promise<string> {
    const skillPath = await getSkillPathAsync(name, this.scope);

    // Check if skill already exists
    if (!options.force && (await pathExists(skillPath))) {
      throw new Error(`Skill "${name}" already exists. Use --force to overwrite.`);
    }

    // Create skill directory
    await ensureDir(skillPath);

    // Write SKILL.md
    await fs.writeFile(path.join(skillPath, 'SKILL.md'), skillMdContent, 'utf-8');

    // Update manifest
    await this.updateManifest(name, options.source);

    return skillPath;
  }

  /**
   * Uninstall a skill
   */
  async uninstallSkill(name: string): Promise<void> {
    const skillPath = await getSkillPathAsync(name, this.scope);

    if (!(await pathExists(skillPath))) {
      throw new Error(`Skill "${name}" not found`);
    }

    await fs.rm(skillPath, { recursive: true, force: true });
    await this.removeFromManifest(name);
  }

  /**
   * Get manifest
   */
  async getManifest(): Promise<OutclawManifest> {
    const manifestPath = await getLockFilePathAsync(this.scope);

    try {
      const content = await fs.readFile(manifestPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return { version: 1, skills: [] };
    }
  }

  /**
   * Update manifest with new skill
   */
  private async updateManifest(name: string, source: SkillSource): Promise<void> {
    const manifestPath = await getLockFilePathAsync(this.scope);
    const manifest = await this.getManifest();

    const entry: SkillManifest = {
      name,
      version: '1.0.0',
      installedAt: new Date().toISOString(),
      source,
      scope: this.scope,
    };

    // Update or add skill entry
    const index = manifest.skills.findIndex((s) => s.name === name);
    if (index >= 0) {
      manifest.skills[index] = entry;
    } else {
      manifest.skills.push(entry);
    }

    await ensureDir(path.dirname(manifestPath));
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  }

  /**
   * Remove skill from manifest
   */
  private async removeFromManifest(name: string): Promise<void> {
    const manifestPath = await getLockFilePathAsync(this.scope);

    try {
      const content = await fs.readFile(manifestPath, 'utf-8');
      const manifest: OutclawManifest = JSON.parse(content);
      manifest.skills = manifest.skills.filter((s) => s.name !== name);
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    } catch {
      // Manifest doesn't exist, nothing to update
    }
  }
}
