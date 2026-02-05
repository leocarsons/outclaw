import { confirm } from '@inquirer/prompts';
import { SkillManager } from '../core/skill-manager.js';
import { ApiClient, ApiError } from '../core/api-client.js';
import { isLoggedIn } from '../core/config.js';
import { logger } from '../ui/logger.js';
import { spinner } from '../ui/spinner.js';
import type { Scope } from '../utils/paths.js';
import type { SkillSource } from '../schemas/manifest.schema.js';

export interface InstallOptions {
  global?: boolean;
  force?: boolean;
  yes?: boolean;
}

interface ParsedSource {
  type: 'github' | 'url' | 'local' | 'registry';
  owner?: string;
  repo?: string;
  skillPath?: string;
  ref?: string;
  url?: string;
  localPath?: string;
  registryId?: string; // UUID or slug for registry
}

// UUID regex pattern
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parse skill specifier to determine source
 * Formats:
 * - github:owner/repo
 * - github:owner/repo@ref
 * - github:owner/repo/path/to/skill
 * - https://github.com/owner/repo
 * - ./local/path
 * - <uuid> (registry ID)
 * - <name> (registry search - single word)
 */
function parseSkillSpecifier(specifier: string): ParsedSource {
  // GitHub shorthand: github:owner/repo[@ref][/path]
  if (specifier.startsWith('github:')) {
    const rest = specifier.slice(7);
    const [ownerRepo, ...pathParts] = rest.split('/');
    const [owner, repoWithRef] = ownerRepo.includes('/')
      ? [ownerRepo.split('/')[0], ownerRepo.split('/').slice(1).join('/')]
      : [ownerRepo, pathParts[0]];

    let repo = repoWithRef || pathParts[0] || '';
    let ref: string | undefined;

    if (repo.includes('@')) {
      [repo, ref] = repo.split('@');
    }

    const skillPath = pathParts.slice(1).join('/');

    return {
      type: 'github',
      owner,
      repo,
      ref,
      skillPath: skillPath || undefined,
    };
  }

  // GitHub URL
  if (specifier.includes('github.com')) {
    const url = new URL(specifier);
    const parts = url.pathname.slice(1).split('/');
    const owner = parts[0];
    let repo = parts[1];
    let ref: string | undefined;

    // Handle .git suffix
    if (repo?.endsWith('.git')) {
      repo = repo.slice(0, -4);
    }

    // Handle tree/branch reference
    if (parts[2] === 'tree' && parts[3]) {
      ref = parts[3];
    }

    const skillPath = parts.slice(4).join('/');

    return {
      type: 'github',
      owner,
      repo,
      ref,
      skillPath: skillPath || undefined,
    };
  }

  // Generic URL
  if (specifier.startsWith('http://') || specifier.startsWith('https://')) {
    return {
      type: 'url',
      url: specifier,
    };
  }

  // Local path
  if (specifier.startsWith('./') || specifier.startsWith('/') || specifier.startsWith('../')) {
    return {
      type: 'local',
      localPath: specifier,
    };
  }

  // GitHub shorthand: owner/repo
  if (specifier.includes('/')) {
    const [owner, repoWithRef] = specifier.split('/');
    let repo = repoWithRef;
    let ref: string | undefined;

    if (repo?.includes('@')) {
      [repo, ref] = repo.split('@');
    }

    return {
      type: 'github',
      owner,
      repo,
      ref,
    };
  }

  // UUID - registry ID
  if (UUID_PATTERN.test(specifier)) {
    return {
      type: 'registry',
      registryId: specifier,
    };
  }

  // Single name - assume registry search/slug
  return {
    type: 'registry',
    registryId: specifier,
  };
}

async function fetchFromGitHub(source: ParsedSource): Promise<{ name: string; content: string }> {
  const { owner, repo, ref = 'main', skillPath = '' } = source;

  // Construct raw GitHub URL for SKILL.md
  const basePath = skillPath ? `${skillPath}/` : '';
  const skillMdUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${basePath}SKILL.md`;

  const response = await fetch(skillMdUrl);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`SKILL.md not found at ${skillMdUrl}`);
    }
    throw new Error(`Failed to fetch skill: ${response.statusText}`);
  }

  const content = await response.text();

  // Extract name from frontmatter or use repo name
  const nameMatch = content.match(/^name:\s*(.+)$/m);
  const name = nameMatch ? nameMatch[1].trim() : repo!;

  return { name, content };
}

async function fetchFromRegistry(
  client: ApiClient,
  registryId: string
): Promise<{ name: string; content: string; workflowId: string }> {
  // Check if it's a UUID or need to search
  if (UUID_PATTERN.test(registryId)) {
    // Direct ID - download
    const content = await client.downloadWorkflow(registryId);
    const workflow = await client.getWorkflow(registryId);

    // Extract name from content frontmatter or use title
    const nameMatch = content.match(/^name:\s*(.+)$/m);
    const name = nameMatch ? nameMatch[1].trim() : workflow.title;

    return { name, content, workflowId: registryId };
  }

  // Search by name/slug
  const results = await client.searchWorkflows(registryId, { limit: 5 });

  if (results.workflows.length === 0) {
    throw new Error(`No skill found matching "${registryId}" in the registry.`);
  }

  // If exact match found, use it
  const exactMatch = results.workflows.find(
    (w) => w.title.toLowerCase() === registryId.toLowerCase() || w.slug === registryId
  );

  const workflow = exactMatch || results.workflows[0];

  if (!exactMatch && results.workflows.length > 1) {
    logger.warn(`Multiple skills found. Installing "${workflow.title}".`);
    logger.dim('Use the workflow ID for exact match: outclaw install <uuid>');
  }

  // Download the content
  const content = await client.downloadWorkflow(workflow.id);

  // Extract name from content frontmatter or use title
  const nameMatch = content.match(/^name:\s*(.+)$/m);
  const name = nameMatch ? nameMatch[1].trim() : workflow.title;

  return { name, content, workflowId: workflow.id };
}

export async function installCommand(specifier: string, options: InstallOptions): Promise<void> {
  const spin = spinner('Resolving skill...').start();

  try {
    // Parse specifier
    const source = parseSkillSpecifier(specifier);

    if (source.type === 'local') {
      spin.fail('Local installation not yet implemented');
      process.exit(1);
    }

    if (source.type === 'url') {
      spin.fail('URL installation not yet implemented');
      process.exit(1);
    }

    let name: string;
    let content: string;
    let skillSource: SkillSource;

    if (source.type === 'registry') {
      // Registry installation requires login
      if (!(await isLoggedIn())) {
        spin.fail('Authentication required');
        logger.error('You must be logged in to install from the registry.');
        logger.dim('Run "outclaw login" to authenticate.');
        process.exit(1);
      }

      spin.text = `Searching registry for "${source.registryId}"...`;

      const client = await ApiClient.create();
      const result = await fetchFromRegistry(client, source.registryId!);

      name = result.name;
      content = result.content;
      skillSource = {
        type: 'registry',
        id: result.workflowId,
      };

      spin.text = `Found skill: ${name}`;
    } else {
      // GitHub installation
      spin.text = `Fetching from GitHub: ${source.owner}/${source.repo}...`;
      const result = await fetchFromGitHub(source);

      name = result.name;
      content = result.content;
      skillSource = {
        type: 'github',
        url: `https://github.com/${source.owner}/${source.repo}`,
        ref: source.ref,
      };

      spin.text = `Found skill: ${name}`;
    }

    // Check for existing skill
    const scope: Scope = options.global ? 'global' : 'project';
    const manager = new SkillManager(scope);

    if (await manager.skillExists(name)) {
      if (!options.force) {
        spin.stop();

        if (!options.yes) {
          const proceed = await confirm({
            message: `Skill "${name}" already exists. Overwrite?`,
            default: false,
          });

          if (!proceed) {
            logger.info('Installation cancelled');
            return;
          }
        }

        spin.start('Installing...');
      }
    }

    // Install
    spin.text = `Installing ${name}...`;

    const skillPath = await manager.installSkill(name, content, {
      force: options.force || false,
      source: skillSource,
    });

    spin.succeed(`Installed ${name}`);
    logger.info('');
    logger.box(`Skill Installed: ${name}`, [
      `Path:  ${skillPath}`,
      `Scope: ${scope}`,
      '',
      `Use /${name} in OpenClaw to invoke this skill`,
    ].join('\n'));
  } catch (error) {
    spin.fail('Installation failed');

    if (error instanceof ApiError) {
      if (error.statusCode === 401) {
        logger.error('Authentication failed. Please run "outclaw login".');
      } else if (error.statusCode === 404) {
        logger.error('Skill not found in the registry.');
      } else {
        logger.error(error.message);
      }
    } else if (error instanceof Error) {
      logger.error(error.message);
    }

    process.exit(1);
  }
}
