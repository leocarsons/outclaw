import * as fs from 'fs/promises';
import * as path from 'path';
import matter from 'gray-matter';
import { SkillFrontmatterSchema, type Skill, type SkillFrontmatter } from '../schemas/skill.schema.js';

export interface SkillStructure {
  hasSkillMd: boolean;
  hasReferences: boolean;
  hasScripts: boolean;
  hasExamples: boolean;
  files: string[];
}

export class SkillParser {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  /**
   * Parse SKILL.md and return the full skill object
   */
  async parse(): Promise<Skill> {
    const skillMdPath = path.join(this.basePath, 'SKILL.md');
    const content = await fs.readFile(skillMdPath, 'utf-8');

    const { data, content: body } = matter(content);

    // Validate frontmatter with Zod
    const frontmatter = SkillFrontmatterSchema.parse(data);

    return {
      ...frontmatter,
      content: body.trim(),
      path: this.basePath,
    };
  }

  /**
   * Parse only the frontmatter without validating
   */
  async parseFrontmatter(): Promise<SkillFrontmatter> {
    const skillMdPath = path.join(this.basePath, 'SKILL.md');
    const content = await fs.readFile(skillMdPath, 'utf-8');

    const { data } = matter(content);
    return SkillFrontmatterSchema.parse(data);
  }

  /**
   * Get the structure of the skill directory
   */
  async getStructure(): Promise<SkillStructure> {
    const structure: SkillStructure = {
      hasSkillMd: false,
      hasReferences: false,
      hasScripts: false,
      hasExamples: false,
      files: [],
    };

    try {
      const entries = await fs.readdir(this.basePath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile() && entry.name === 'SKILL.md') {
          structure.hasSkillMd = true;
        } else if (entry.isDirectory()) {
          switch (entry.name) {
            case 'references':
              structure.hasReferences = true;
              break;
            case 'scripts':
              structure.hasScripts = true;
              break;
            case 'examples':
              structure.hasExamples = true;
              break;
          }
        }
        structure.files.push(entry.name);
      }
    } catch {
      // Directory doesn't exist
    }

    return structure;
  }

  /**
   * Check if a valid skill exists at this path
   */
  async isValid(): Promise<boolean> {
    try {
      await this.parse();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Parse SKILL.md content string and return frontmatter and body
 */
export function parseSkillFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const { data, content: body } = matter(content);
  return { frontmatter: data, body: body.trim() };
}

/**
 * Generate SKILL.md content from frontmatter and body
 */
export function generateSkillMd(frontmatter: Partial<SkillFrontmatter>, body: string): string {
  const yamlLines: string[] = [];

  if (frontmatter.name) {
    yamlLines.push(`name: ${frontmatter.name}`);
  }
  if (frontmatter.description) {
    yamlLines.push(`description: ${frontmatter.description}`);
  }
  if (frontmatter.version) {
    yamlLines.push(`version: ${frontmatter.version}`);
  }
  if (frontmatter['disable-model-invocation'] !== undefined) {
    yamlLines.push(`disable-model-invocation: ${frontmatter['disable-model-invocation']}`);
  }
  if (frontmatter['user-invocable'] !== undefined) {
    yamlLines.push(`user-invocable: ${frontmatter['user-invocable']}`);
  }
  if (frontmatter['allowed-tools']?.length) {
    const tools = Array.isArray(frontmatter['allowed-tools'])
      ? frontmatter['allowed-tools'].join(', ')
      : frontmatter['allowed-tools'];
    yamlLines.push(`allowed-tools: ${tools}`);
  }
  if (frontmatter['argument-hint']) {
    yamlLines.push(`argument-hint: ${frontmatter['argument-hint']}`);
  }
  if (frontmatter.model) {
    yamlLines.push(`model: ${frontmatter.model}`);
  }
  if (frontmatter.context) {
    yamlLines.push(`context: ${frontmatter.context}`);
  }
  if (frontmatter.agent) {
    yamlLines.push(`agent: ${frontmatter.agent}`);
  }

  return `---
${yamlLines.join('\n')}
---

${body}
`;
}
