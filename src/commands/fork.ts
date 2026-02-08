import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { confirm } from '@inquirer/prompts';
import { ApiClient, ApiError, type PublishWorkflowRequest } from '../core/api-client.js';
import { isLoggedIn, loadConfig } from '../core/config.js';
import { logger } from '../ui/logger.js';
import { spinner } from '../ui/spinner.js';
import { parseSkillFrontmatter } from '../parsers/skill-parser.js';

const CLAWHUB_REGISTRY = 'https://clawhub.ai';

export interface ForkOptions {
  version?: string;
  yes?: boolean;
  title?: string;
  description?: string;
}

/**
 * Fetch skill metadata from ClawHub
 */
async function fetchClawHubSkill(slug: string): Promise<{
  slug: string;
  displayName?: string;
  summary?: string;
  latestVersion?: { version: string };
}> {
  const url = `${CLAWHUB_REGISTRY}/api/v1/skills/${encodeURIComponent(slug)}`;
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Skill "${slug}" not found on ClawHub.`);
    }
    throw new Error(`ClawHub API error: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as any;
}

/**
 * Download skill zip from ClawHub
 */
async function downloadClawHubZip(slug: string, version: string): Promise<Buffer> {
  const url = `${CLAWHUB_REGISTRY}/api/v1/download?slug=${encodeURIComponent(slug)}&version=${encodeURIComponent(version)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download skill: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Extract SKILL.md from zip and check file count
 */
async function extractSkillFromZip(zipBuffer: Buffer): Promise<{
  skillMdContent: string;
  fileCount: number;
  fileList: string[];
}> {
  // Write zip to temp file
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'outclaw-fork-'));
  const zipPath = path.join(tempDir, 'skill.zip');
  const extractDir = path.join(tempDir, 'extracted');

  try {
    await fs.writeFile(zipPath, zipBuffer);
    await fs.mkdir(extractDir, { recursive: true });

    // Extract zip
    execSync(`unzip -o "${zipPath}" -d "${extractDir}"`, { stdio: 'pipe' });

    // List all files
    const fileList = await listFiles(extractDir);

    // Find SKILL.md
    const skillMdPath = fileList.find(
      (f) => path.basename(f).toLowerCase() === 'skill.md'
    );

    if (!skillMdPath) {
      throw new Error('No SKILL.md found in the downloaded skill.');
    }

    const skillMdContent = await fs.readFile(
      path.join(extractDir, skillMdPath),
      'utf-8'
    );

    return {
      skillMdContent,
      fileCount: fileList.length,
      fileList,
    };
  } finally {
    // Clean up temp files
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

/**
 * Recursively list files in a directory
 */
async function listFiles(dir: string, prefix = ''): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      // Skip hidden dirs
      if (entry.name.startsWith('.')) continue;
      files.push(...(await listFiles(path.join(dir, entry.name), relativePath)));
    } else {
      // Skip hidden files and origin metadata
      if (entry.name.startsWith('.')) continue;
      files.push(relativePath);
    }
  }

  return files;
}

export async function forkCommand(slug: string, options: ForkOptions): Promise<void> {
  // Check auth
  if (!(await isLoggedIn())) {
    logger.error('You must be logged in to fork skills.');
    logger.dim('Run "outclaw login" to authenticate.');
    process.exit(1);
  }

  const config = await loadConfig();
  if (!config.verified) {
    logger.error('Your agent must be verified to publish.');
    logger.dim('Visit https://outclaws.ai to complete verification.');
    process.exit(1);
  }

  const spin = spinner(`Fetching "${slug}" from ClawHub...`).start();

  try {
    // 1. Get skill metadata from ClawHub
    const skillMeta = await fetchClawHubSkill(slug);
    const version = options.version || skillMeta.latestVersion?.version;

    if (!version) {
      spin.fail('Could not resolve skill version');
      logger.error('No version found for this skill.');
      process.exit(1);
    }

    spin.text = `Downloading ${slug}@${version} from ClawHub...`;

    // 2. Download zip
    const zipBuffer = await downloadClawHubZip(slug, version);

    spin.text = 'Extracting skill...';

    // 3. Extract and check files
    const { skillMdContent, fileCount, fileList } = await extractSkillFromZip(zipBuffer);

    spin.stop();

    // 4. Show info
    const parsed = parseSkillFrontmatter(skillMdContent);
    const title = options.title || slug;
    const description = options.description || skillMeta.summary || (parsed.frontmatter?.description as string) || '';

    logger.info('');
    logger.box(`Fork: ${slug}@${version}`, [
      `Title:       ${title}`,
      `Description: ${description.length > 50 ? description.slice(0, 47) + '...' : description}`,
      `Files:       ${fileCount}`,
      `Source:      ClawHub`,
    ].join('\n'));

    if (fileCount > 1) {
      logger.info('');
      logger.warn(`This skill has ${fileCount} files, but Outclaws currently only supports single SKILL.md.`);
      logger.dim('Only the SKILL.md content will be published. Other files:');
      for (const file of fileList.filter((f) => f.toLowerCase() !== 'skill.md')) {
        logger.dim(`  - ${file}`);
      }
    }

    // 5. Confirm
    if (!options.yes) {
      logger.info('');
      const proceed = await confirm({
        message: 'Publish this skill to Outclaws?',
        default: true,
      });

      if (!proceed) {
        logger.info('Fork cancelled.');
        return;
      }
    }

    // 6. Publish to Outclaws
    const publishSpin = spinner('Publishing to Outclaws...').start();

    const client = await ApiClient.create();
    const request: PublishWorkflowRequest = {
      title: title.trim(),
      description: description.trim() || title.trim(),
      content: skillMdContent,
    };

    const response = await client.publishWorkflow(request);

    if (response.status === 'published') {
      publishSpin.succeed('Forked and published successfully!');
      logger.info('');
      logger.box(`Published: ${title}`, [
        `ID:     ${response.id}`,
        `URL:    https://outclaws.ai/workflow/${response.id}`,
        `Source: ClawHub/${slug}@${version}`,
      ].join('\n'));
    } else {
      publishSpin.fail('Skill rejected by security scan');
      logger.error(response.message);

      if (response.security_scan) {
        logger.info('');
        logger.warn('Risk factors:');
        for (const factor of response.security_scan.risk_factors) {
          logger.dim(`  - ${factor}`);
        }
      }

      process.exit(1);
    }
  } catch (error) {
    spin.fail('Fork failed');

    if (error instanceof ApiError) {
      logger.error(error.message);
    } else if (error instanceof Error) {
      logger.error(error.message);
    }

    process.exit(1);
  }
}
